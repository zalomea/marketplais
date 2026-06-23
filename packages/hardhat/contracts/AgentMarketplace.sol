// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { EnumerableSet } from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import { IIdentityRegistry } from "./interfaces/IIdentityRegistry.sol";
import { IAgentMarketplace } from "./interfaces/IAgentMarketplace.sol";

contract AgentMarketplace is IAgentMarketplace, ERC721Holder {
    using EnumerableSet for EnumerableSet.UintSet;

    address public owner;
    IIdentityRegistry public immutable identityRegistry;

    mapping(uint256 => Agent) public agents;
    uint256[] public allAgentIds;

    // EnumerableSet for efficient owner-based lookups
    mapping(address => EnumerableSet.UintSet) private _ownerAgents;

    uint256 public constant WAITING_PERIOD = 7 days; // Waiting period to transfer ownership.
    address public pendingOwner;
    uint256 public waitOwnerUntil; // Timestamp from which the pending owner can accept ownership.

    event AgentRegistered(uint256 indexed agentId, address indexed owner, uint256 price, bool payToAgentWallet);
    event AgentDeactivated(uint256 indexed agentId, uint256 time);
    event PriceUpdated(uint256 indexed agentId, uint256 oldPrice, uint256 newPrice, uint256 time);
    event AgentReactivated(uint256 indexed agentId, uint256 time);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner, uint256 time);
    event AgentTransferred(uint256 indexed agentId, address indexed from, address indexed to);
    event PaymentDestinationUpdated(uint256 indexed agentId, bool payToAgentWallet);

    error ZeroPrice();
    error EmptyURI();
    error AgentNotFoundInMarketplace();
    error ZeroAddress();
    error NotOwnerOfAgent();
    error AlreadyDeactivated();
    error SamePrice();
    error AlreadyActive();
    error InvalidPage();
    error NotOwner();
    error SameOwner();
    error SamePaymentDestination();
    error WaitingPeriodNotOver();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _identityRegistry) {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IIdentityRegistry(_identityRegistry);
        owner = msg.sender;
    }

    // slither-disable-start reentrancy-benign,reentrancy-events
    function register(uint256 price, string memory agentURI, bool payToAgentWallet) external returns (uint256 agentId) {
        //cannot be <0 as it is uint and in this version of Solidity it would revert negative inputs as uints
        if (price == 0) revert ZeroPrice();
        if (bytes(agentURI).length == 0) revert EmptyURI();
        agentId = identityRegistry.register(agentURI);

        agents[agentId] = Agent({
            owner: msg.sender,
            agentId: agentId,
            price: price,
            payToAgentWallet: payToAgentWallet,
            active: true
        });
        allAgentIds.push(agentId);
        // slither-disable-next-line unused-return
        _ownerAgents[msg.sender].add(agentId);
        emit AgentRegistered(agentId, msg.sender, price, payToAgentWallet);

        //As we are the owner currently we have to transfer the ownership to the msg.sender
        identityRegistry.safeTransferFrom(address(this), msg.sender, agentId);
    }

    // Register an existing agent by ID
    function register(uint256 price, uint256 agentId, bool payToAgentWallet) external returns (uint256) {
        // Ensure caller owns the agent token
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        if (price == 0) revert ZeroPrice();
        // Ensure not already registered
        if (agents[agentId].agentId != 0) revert AlreadyActive();
        agents[agentId] = Agent({
            owner: msg.sender,
            agentId: agentId,
            price: price,
            payToAgentWallet: payToAgentWallet,
            active: true
        });
        allAgentIds.push(agentId);
        // slither-disable-next-line unused-return
        _ownerAgents[msg.sender].add(agentId);
        emit AgentRegistered(agentId, msg.sender, price, payToAgentWallet);
        return agentId;
    }

    function transferAgent(uint256 agentId, address newOwner) external {
        if (newOwner == address(0)) revert ZeroAddress();
        if (agents[agentId].agentId != agentId) revert AgentNotFoundInMarketplace();

        address currentOwner = identityRegistry.ownerOf(agentId);

        if (msg.sender != currentOwner) revert NotOwnerOfAgent();
        if (currentOwner == newOwner) revert SameOwner();

        agents[agentId].owner = newOwner;
        // slither-disable-next-line unused-return
        _ownerAgents[currentOwner].remove(agentId);
        // slither-disable-next-line unused-return
        _ownerAgents[newOwner].add(agentId);

        emit AgentTransferred(agentId, currentOwner, newOwner);

        identityRegistry.safeTransferFrom(currentOwner, newOwner, agentId);
    }

    function syncAgentOwnership(uint256 agentId) external {
        if (agents[agentId].agentId != agentId) revert AgentNotFoundInMarketplace();

        address currentOwner = identityRegistry.ownerOf(agentId);
        address marketplaceRecordedOwner = agents[agentId].owner;

        if (currentOwner == marketplaceRecordedOwner) revert SameOwner();

        agents[agentId].owner = currentOwner;
        // slither-disable-next-line unused-return
        _ownerAgents[marketplaceRecordedOwner].remove(agentId);
        // slither-disable-next-line unused-return
        _ownerAgents[currentOwner].add(agentId);

        emit AgentTransferred(agentId, marketplaceRecordedOwner, currentOwner);
    }

    /// @notice Returns the list of agents owned by a specific address.
    function getAgentsByOwner(address agentOwner) external view returns (AgentFullDetails[] memory) {
        uint256[] memory agentIds = _ownerAgents[agentOwner].values();
        AgentFullDetails[] memory details = new AgentFullDetails[](agentIds.length);
        for (uint256 i = 0; i < agentIds.length; i++) {
            details[i] = getAgentFullDetails(agentIds[i]);
        }
        return details;
    }

    // slither-disable-end reentrancy-benign,reentrancy-events

    function deactivateAgent(uint256 agentId) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        Agent storage agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (!agent.active) revert AlreadyDeactivated();
        agent.active = false;
        emit AgentDeactivated(agentId, block.timestamp);
    }

    function reactivateAgent(uint256 agentId) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        Agent storage agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (agent.active) revert AlreadyActive();
        agent.active = true;
        emit AgentReactivated(agentId, block.timestamp);
    }

    function updatePrice(uint256 agentId, uint256 newPrice) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        Agent storage agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (newPrice == 0) revert ZeroPrice();
        if (newPrice == agent.price) revert SamePrice();
        emit PriceUpdated(agentId, agent.price, newPrice, block.timestamp);
        agent.price = newPrice;
    }

    function setPaymentDestination(uint256 agentId, bool newPayToAgentWallet) external {
        Agent storage agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        if (agent.payToAgentWallet == newPayToAgentWallet) revert SamePaymentDestination();
        agent.payToAgentWallet = newPayToAgentWallet;
        emit PaymentDestinationUpdated(agentId, newPayToAgentWallet);
    }

    function getAgent(uint256 agentId) public view returns (Agent memory) {
        Agent memory agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        return agent;
    }

    // slither-disable-next-line calls-loop
    function getAgentFullDetails(uint256 agentId) public view returns (AgentFullDetails memory) {
        Agent memory agent = getAgent(agentId);

        address agentOwner = address(0);
        try identityRegistry.ownerOf(agentId) returns (address o) {
            agentOwner = o;
        } catch {
            // Token burned or non-existent in the registry — return inactive, zeroed-out record
            agent.active = false;
            return AgentFullDetails(agent, address(0), "");
        }

        string memory uri = "";
        try identityRegistry.tokenURI(agentId) returns (string memory u) {
            uri = u;
        } catch {
            uri = "";
        }

        return AgentFullDetails(agent, agentOwner, uri);
    }

    function getAgentsFullPaginated(uint256 page, uint256 count) external view returns (AgentFullDetails[] memory) {
        if (page == 0) revert InvalidPage();
        if (count == 0) return new AgentFullDetails[](0);

        uint256 totalAgents = allAgentIds.length;
        uint256 startIndex = (page - 1) * count;

        if (startIndex >= totalAgents) revert InvalidPage();

        uint256 endIndex = startIndex + count;
        if (endIndex > totalAgents) {
            endIndex = totalAgents;
        }

        uint256 actualCount = endIndex - startIndex;
        AgentFullDetails[] memory res = new AgentFullDetails[](actualCount);

        for (uint256 i = 0; i < actualCount; i++) {
            res[i] = getAgentFullDetails(allAgentIds[startIndex + i]);
        }

        return res;
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

    function rescueERC721(address nftContract, uint256 tokenId) external onlyOwner {
        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);
    }
}
