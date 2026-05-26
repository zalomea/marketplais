// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import "./interfaces/IIdentityRegistry.sol";
import "./interfaces/IAgentMarketplace.sol";

contract AgentMarketplace {
    IIdentityRegistry public identityRegistry;

    mapping(uint256 => IAgentMarketplace.Agent) public agents;
    uint256[] public allAgentIds;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, uint256 price, bool payToAgentWallet);
    event AgentDeactivated(uint256 indexed agentId, uint256 time);
    event PriceUpdated(uint256 indexed agentId, uint256 oldPrice, uint256 newPrice, uint256 time);
    event AgentReactivated(uint256 indexed agentId, uint256 time);

    error ZeroPrice();
    error EmptyURI();
    error AgentNotFoundInMarketplace();
    error ZeroAddress();
    error NotOwnerOfAgent();
    error AlreadyDeactivated();
    error SamePrice();
    error AlreadyActive();
    error InvalidPage();

    constructor(address _identityRegistry) {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }

    function register(
        uint256 _price,
        string memory agentURI,
        bool _payToAgentWallet
    ) external returns (uint256 agentId) {
        //cannot be <0 as it is uint and in this version of Solidity it would revert negative inputs as uints
        if (_price == 0) revert ZeroPrice();
        if (bytes(agentURI).length == 0) revert EmptyURI();
        agentId = identityRegistry.register(agentURI);
        //As we are the owner currently we have to transfer the ownership to the msg.sender
        identityRegistry.transferOwnership(msg.sender);
        agents[agentId] = IAgentMarketplace.Agent({
            agentId: agentId,
            price: _price,
            payToAgentWallet: _payToAgentWallet,
            active: true
        });
        allAgentIds.push(agentId);
        emit AgentRegistered(agentId, msg.sender, _price, _payToAgentWallet);
    }

    function deactivateAgent(uint256 agentId) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        IAgentMarketplace.Agent storage agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (agent.active == false) revert AlreadyDeactivated();
        agent.active = false;
        emit AgentDeactivated(agentId, block.timestamp);
    }

    function reactivateAgent(uint256 agentId) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        IAgentMarketplace.Agent storage agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (agent.active == true) revert AlreadyActive();
        agent.active = true;
        emit AgentReactivated(agentId, block.timestamp);
    }

    function updatePrice(uint256 agentId, uint256 newPrice) external {
        if (identityRegistry.ownerOf(agentId) != msg.sender) revert NotOwnerOfAgent();
        IAgentMarketplace.Agent storage agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        if (newPrice == 0) revert ZeroPrice();
        if (newPrice == agent.price) revert SamePrice();
        emit PriceUpdated(agentId, agent.price, newPrice, block.timestamp);
        agent.price = newPrice;
    }

    function getAgent(uint256 agentId) public view returns (IAgentMarketplace.Agent memory) {
        IAgentMarketplace.Agent memory agent = agents[agentId];
        if (agent.agentId != agentId) revert AgentNotFoundInMarketplace();
        return agent;
    }

    function getAgentsPaginated(uint256 page, uint256 count) external view returns (IAgentMarketplace.Agent[] memory) {
        if (page == 0) revert InvalidPage();
        IAgentMarketplace.Agent[] memory res = new IAgentMarketplace.Agent[](count);
        for (uint256 i = (page - 1) * count; i < page * count; i++) {
            res[i - (page - 1) * count] = getAgent(allAgentIds[i]);
        }
        return res;
    }
}
