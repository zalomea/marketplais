// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { IIdentityRegistry } from "./interfaces/IIdentityRegistry.sol";
import { IAgentMarketplace } from "./interfaces/IAgentMarketplace.sol";
import { IUSDC } from "./interfaces/IUSDC.sol";
import { IReputationRegistry } from "./interfaces/IReputationRegistry.sol";

contract MarketplaceRouter {
    address public owner;
    IAgentMarketplace public immutable agentMarketplace;
    IReputationRegistry public immutable reputationRegistry;
    IUSDC public immutable token;
    address public relayer;

    uint256 public feeBps;
    uint256 public constant WAITING_PERIOD = 7 days;
    address public pendingOwner;
    uint256 public waitOwnerUntil;
    address public treasury;

    mapping(uint256 => uint256) public agentBalances;
    uint256 public totalAgentLiabilities;
    // USDC held in escrow, not yet assigned to agents or fees
    uint256 public totalLocked;
    mapping(bytes32 => bool) public processesNonces;

    error AgentNotActive();
    error NotOwner();
    error NotRelayer();
    error NoFeesToWithdraw();
    error ZeroAddress();
    error InsufficientAmount();
    error FeeTooHigh();
    error SameOwner();
    error SameFeeBps();
    error TransferFailed();
    error WaitingPeriodNotOver();
    error InvalidAuthorization();
    error AgentNotFoundInMarketplace();
    error PaymentAlreadyProcessed();
    error PaymentNotLocked();

    event FeesWithdrawn(uint256 tokenAmount, uint256 time);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner, uint256 time);
    event FeeBpsUpdated(uint256 oldFeeBps, uint256 newFeeBps, uint256 time);
    event RelayerUpdated(address indexed newRelayer);
    event PaymentLocked(
        bytes32 indexed nonce,
        address indexed client,
        uint256 indexed agentId,
        uint256 totalAmount,
        uint256 agentEarnings
    );
    event PaymentFinalized(bytes32 indexed nonce, uint256 indexed agentId, uint256 agentEarnings);
    event PaymentRefunded(bytes32 indexed nonce, address indexed client, uint256 refundedAmount, uint256 feeRetained);
    event ReputationFeedbackFailed(bytes32 indexed nonce, uint256 indexed agentId, string reason);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert NotRelayer();
        _;
    }

    constructor(
        address _agentMarketplace,
        address _reputationRegistry,
        address _token,
        uint256 _feeBps,
        address _treasury
    ) {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_agentMarketplace == address(0)) revert ZeroAddress();
        if (_token == address(0)) revert ZeroAddress();
        if (_feeBps > 1000) revert FeeTooHigh();
        treasury = _treasury;
        agentMarketplace = IAgentMarketplace(_agentMarketplace);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
        token = IUSDC(_token);
        feeBps = _feeBps;
        owner = msg.sender;
        relayer = msg.sender;
    }

    function withdrawFees() external onlyOwner {
        uint256 currentBalance = token.balanceOf(address(this));

        if (currentBalance <= totalAgentLiabilities + totalLocked) revert NoFeesToWithdraw();

        uint256 available = currentBalance - totalAgentLiabilities - totalLocked;

        emit FeesWithdrawn(available, block.timestamp);

        bool success = token.transfer(treasury, available);
        if (!success) revert TransferFailed();
    }

    function withdrawAgentEarnings(uint256 agentId) external {
        IAgentMarketplace.Agent memory agent = agentMarketplace.getAgent(agentId);
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (agentBalances[agentId] == 0) revert NoFeesToWithdraw();
        uint256 amountToTransfer = agentBalances[agentId];
        address receipient = IIdentityRegistry(agentMarketplace.identityRegistry()).ownerOf(agentId);
        if (agent.payToAgentWallet) {
            receipient = IIdentityRegistry(agentMarketplace.identityRegistry()).getAgentWallet(agentId);
        }
        if (receipient == address(0)) revert ZeroAddress();
        agentBalances[agentId] = 0;
        totalAgentLiabilities -= amountToTransfer;
        emit FeesWithdrawn(amountToTransfer, block.timestamp);
        bool success = token.transfer(receipient, amountToTransfer);
        if (!success) revert TransferFailed();
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == owner) revert SameOwner();
        pendingOwner = newOwner;
        waitOwnerUntil = block.timestamp + WAITING_PERIOD;
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        // slither-disable-next-line timestamp
        if (block.timestamp < waitOwnerUntil) revert WaitingPeriodNotOver();

        emit OwnerTransferred(owner, pendingOwner, block.timestamp);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function changeTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
    }

    function updateFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert FeeTooHigh();
        if (newFeeBps == feeBps) revert SameFeeBps();
        emit FeeBpsUpdated(feeBps, newFeeBps, block.timestamp);
        feeBps = newFeeBps;
    }

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert ZeroAddress();
        emit RelayerUpdated(newRelayer);
        relayer = newRelayer;
    }

    struct LockedPayment {
        uint256 agentId;
        address client;
        uint256 totalAmount;
        uint256 agentEarnings;
        bool active;
    }

    mapping(bytes32 => LockedPayment) public lockedPayments;

    function lockPayment(
        address client,
        uint256 agentId,
        uint256 amount,
        uint256 validUntil,
        bytes32 nonce,
        bytes calldata signature
    ) external onlyRelayer {
        if (lockedPayments[nonce].active || processesNonces[nonce]) revert PaymentAlreadyProcessed();
        IAgentMarketplace.Agent memory agent = agentMarketplace.getAgent(agentId);
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (!agent.active) revert AgentNotActive();
        uint256 agentEarnings = agent.price;
        uint256 platformFee = (agentEarnings * feeBps) / 10000;
        uint256 expectedTotal = agentEarnings + platformFee;
        if (amount < expectedTotal) revert InsufficientAmount();
        lockedPayments[nonce] = LockedPayment({
            agentId: agentId,
            client: client,
            totalAmount: amount,
            agentEarnings: agentEarnings,
            active: true
        });
        totalLocked += amount;
        processesNonces[nonce] = true;
        if (signature.length != 65) revert InvalidAuthorization();
        bytes32 r;
        bytes32 s;
        uint8 v;
        // slither-disable-next-line assembly
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        emit PaymentLocked(nonce, client, agentId, amount, agentEarnings);
        IUSDC(token).receiveWithAuthorization(client, address(this), amount, 0, validUntil, nonce, v, r, s);
    }

    function finalizePayment(bytes32 nonce) external onlyRelayer {
        LockedPayment storage payment = lockedPayments[nonce];
        if (!payment.active) revert PaymentNotLocked();
        uint256 agentId = payment.agentId;
        uint256 agentEarnings = payment.agentEarnings;
        uint256 totalAmount = payment.totalAmount;
        payment.active = false;
        delete lockedPayments[nonce];
        totalLocked -= totalAmount;
        agentBalances[agentId] += agentEarnings;
        totalAgentLiabilities += agentEarnings;
        emit PaymentFinalized(nonce, agentId, agentEarnings);
        _recordReputationFeedback(nonce, agentId, int128(1), "execution_success");
    }

    function refundPayment(bytes32 nonce) external onlyRelayer {
        LockedPayment storage payment = lockedPayments[nonce];
        if (!payment.active) revert PaymentNotLocked();
        uint256 totalAmount = payment.totalAmount;
        uint256 agentEarnings = payment.agentEarnings;
        address client = payment.client;
        uint256 agentId = payment.agentId;
        payment.active = false;
        delete lockedPayments[nonce];
        totalLocked -= totalAmount;
        // Refund only agent earnings; platform fee is retained to cover gas costs
        // incurred by the relayer regardless of agent outcome.
        uint256 feeRetained = totalAmount - agentEarnings;
        emit PaymentRefunded(nonce, client, agentEarnings, feeRetained);
        bool success = token.transfer(client, agentEarnings);
        if (!success) revert TransferFailed();
        _recordReputationFeedback(nonce, agentId, int128(0), "execution_failed");
    }

    /**
     * @dev Records reputation feedback for a settled payment. The call is wrapped
     * in try/catch so a reverting reputation registry cannot trap funds in escrow.
     */
    function _recordReputationFeedback(bytes32 nonce, uint256 agentId, int128 value, string memory tag1) internal {
        try reputationRegistry.giveFeedback(agentId, value, uint8(0), tag1, "x402_payment", "", "", bytes32(0)) {
            return;
        } catch {
            // slither-disable-next-line reentrancy-events
            emit ReputationFeedbackFailed(nonce, agentId, "giveFeedback reverted");
        }
    }
}
