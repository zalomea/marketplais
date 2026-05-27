// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IAgentMarketplace} from "./interfaces/IAgentMarketplace.sol";
import {IERC20} from "./interfaces/IERC20.sol";

contract MarketplaceRouter {
    address public owner;
    IAgentMarketplace public immutable agentMarketplace;
    IERC20 public immutable token;

    uint256 public feeBps; //will be the fee amount in basis points , meaning 1% = 100 or 15% = 1500//
    uint256 public constant WAITING_PERIOD = 7 days; // Waiting period to transfer ownership.
    address public pendingOwner;
    uint256 public waitOwnerUntil; // Timestamp from which the pending owner can accept ownership.
    address public treasury; // The address that will hold the funds. By using a different one we decentralize the power of the contract so if someone manages to take control of the owner he doesn´t steal the funds. //

    mapping(uint256 => uint256) public agentBalances; // This is to keep track of the balance of each agent, this way we can make sure that the agent has enough balance to cover the payments and fees. //
    mapping(bytes32 => bool) public proccessesNonces; // This is to keep track of the nonces that have been proccessed, this way we can prevent replay attacks.

    error AgentNotActive();
    error NotOwner();
    error NoFeesToWithdraw();
    error ZeroAddress();
    error ZeroPrice();
    error FeeTooHigh();
    error SameOwner();
    error SameFeeBps();
    error TransferFailed();
    error WaitingPeriodNotOver();
    error InvalidAuthorization();
    error AgentNotFoundInMarketplace();

    event PaymentRouted(address indexed client, uint256 indexed agentId, uint256 amount);
    event FeesWithdrawn(uint256 tokenAmount, uint256 time);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner, uint256 time);
    event FeeBpsUpdated(uint256 oldFeeBps, uint256 newFeeBps, uint256 time);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _agentMarketplace, address _token, uint256 _feeBps, address _treasury) {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_agentMarketplace == address(0)) revert ZeroAddress();
        if (_token == address(0)) revert ZeroAddress();
        //the max fee percentage alloweed is 10%
        if (_feeBps > 1000) revert FeeTooHigh();
        treasury = _treasury;
        agentMarketplace = IAgentMarketplace(_agentMarketplace);
        token = IERC20(_token);
        //it is possible for the deployer to use 0 fees
        feeBps = _feeBps;
        owner = msg.sender;
    }

    function withdrawFees() external onlyOwner {
        // slither-disable-next-line incorrect-equality
        if (token.balanceOf(address(this)) == 0) revert NoFeesToWithdraw();

        emit FeesWithdrawn(token.balanceOf(address(this)), block.timestamp);
        
        bool success = token.transfer(treasury, token.balanceOf(address(this)));
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

        agentBalances[agentId] = 0; // Set the agent balance to 0 before the transfer to prevent reentrancy attacks.
        emit FeesWithdrawn(amountToTransfer, block.timestamp);
        
        bool success = token.transfer(receipient, amountToTransfer);
        if (!success) revert TransferFailed();
    }

    //To transfer ownership of the marketplace there is a two-step verification. First the actual owner approves a new address and then this new//
    //address has to call acceptOwnership. this prevents commiting mistakes, and brings extra security in a crticial process. //

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

    function processAgentPayment(
        address client,
        uint256 agentId,
        uint256 amount,
        uint256 validUntil,
        bytes32 nonce,
        bytes calldata signature
    ) external onlyOwner {
        if (proccessesNonces[nonce]) revert TransferFailed(); // This is to prevent replay attacks, if the nonce has been proccessed it cannot be used again. //
        IAgentMarketplace.Agent memory agent = agentMarketplace.getAgent(agentId);
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (!agent.active) revert AgentNotActive();
        if (amount < agent.price) revert TransferFailed(); // The amount sent by the client has to be at least the price of the agent. //
        proccessesNonces[nonce] = true; // Mark the nonce as processed to prevent replay attacks.

        if (signature.length != 65) revert InvalidAuthorization();
        bytes32 r;
        bytes32 s;
        uint8 v;
        // slither-disable-next-line assembly
        assembly {
            // r toma los primeros 32 bytes de los datos (posición inicial: offset)
            r := calldataload(signature.offset)

            // s toma los siguientes 32 bytes (offset + 32)
            s := calldataload(add(signature.offset, 32))

            // v toma el primer byte (índice 0) de la palabra que empieza en offset + 64
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        agentBalances[agentId] += agent.price;
        emit PaymentRouted(client, agentId, amount);

        IERC20(token).transferWithAuthorization(client, address(this), amount, 0, validUntil, nonce, v, r, s);
    }
}
