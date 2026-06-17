// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IIdentityRegistry } from "./interfaces/IIdentityRegistry.sol";
import { IAgentMarketplace } from "./interfaces/IAgentMarketplace.sol";

contract AgentMarketplace is IAgentMarketplace, ERC721Holder {
    address public owner;
    IIdentityRegistry public immutable identityRegistry;

    mapping(uint256 => Agent) public agents;
    uint256[] public allAgentIds;

    uint256 public constant WAITING_PERIOD = 7 days; // Waiting period to transfer ownership.
    address public pendingOwner;
    uint256 public waitOwnerUntil; // Timestamp from which the pending owner can accept ownership.

    event AgentRegistered(uint256 indexed agentId, address indexed owner, uint256 price, bool payToAgentWallet);
    event AgentDeactivated(uint256 indexed agentId, uint256 time);
    event PriceUpdated(uint256 indexed agentId, uint256 oldPrice, uint256 newPrice, uint256 time);
    event AgentReactivated(uint256 indexed agentId, uint256 time);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner, uint256 time);

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
            agentId: agentId,
            price: price,
            payToAgentWallet: payToAgentWallet,
            active: true
        });
        allAgentIds.push(agentId);
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
            agentId: agentId,
            price: price,
            payToAgentWallet: payToAgentWallet,
            active: true
        });
        allAgentIds.push(agentId);
        emit AgentRegistered(agentId, msg.sender, price, payToAgentWallet);
        return agentId;
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

    function getAgent(uint256 agentId) public view returns (Agent memory) {
        Agent memory agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        return agent;
    }

    function totalAgents() external view returns (uint256) {
        return allAgentIds.length;
    }

    // slither-disable-next-line calls-loop
    function getAgentFullDetails(uint256 agentId) public view returns (AgentFullDetails memory) {
        Agent memory agent = getAgent(agentId);
        address agentOwner = identityRegistry.ownerOf(agentId);
        string memory uri = identityRegistry.tokenURI(agentId);

        return AgentFullDetails(agent, agentOwner, uri);
    }

    function getAgentsFullPaginated(uint256 page, uint256 count) external view returns (AgentFullDetails[] memory) {
        if (page == 0) revert InvalidPage();
        if (count == 0) return new AgentFullDetails[](0);

        uint256 totalAgentsCount = allAgentIds.length;
        if (totalAgentsCount == 0) {
            return new AgentFullDetails[](0);
        }
        uint256 startIndex = (page - 1) * count;

        if (startIndex >= totalAgentsCount) {
            return new AgentFullDetails[](0);
        }

        uint256 endIndex = startIndex + count;
        if (endIndex > totalAgentsCount) {
            endIndex = totalAgentsCount;
        }

        uint256 actualCount = endIndex - startIndex;
        AgentFullDetails[] memory res = new AgentFullDetails[](actualCount);

        for (uint256 i = 0; i < actualCount; i++) {
            res[i] = getAgentFullDetails(allAgentIds[startIndex + i]);
        }

        return res;
    }

    // slither-disable-next-line calls-loop
    function getAgentsByOwner(address agentOwner) external view returns (AgentFullDetails[] memory) {
        if (agentOwner == address(0)) revert ZeroAddress();

        uint256 allAgentsCount = allAgentIds.length;
        uint256 ownerAgentCount = 0;

        for (uint256 i = 0; i < allAgentsCount; i++) {
            if (identityRegistry.ownerOf(allAgentIds[i]) == agentOwner) {
                ownerAgentCount++;
            }
        }

        AgentFullDetails[] memory res = new AgentFullDetails[](ownerAgentCount);
        uint256 resultIndex = 0;

        for (uint256 i = 0; i < allAgentsCount; i++) {
            uint256 agentId = allAgentIds[i];
            if (identityRegistry.ownerOf(agentId) == agentOwner) {
                res[resultIndex] = getAgentFullDetails(agentId);
                resultIndex++;
            }
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
