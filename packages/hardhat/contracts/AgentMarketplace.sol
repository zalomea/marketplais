// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import "./interfaces/IIdentityRegistry.sol";

contract AgentMarketplace{
    IIdentityRegistry public identityRegistry;

    struct Agent{
        uint256 agentId;
        string name ; 
        string endpoint ;
        uint256 price;
        address owner;
        bool active;
    }

    mapping(uint256 => Agent) public agents ; 
    mapping (address=>uint256[]) public ownerAgents ;
    uint256[]public allAgentIds;
    uint256 public activeAgentsCounter;

    event AgentRegistered(uint256 indexed agentId,string name, address indexed owner,uint256 price);
    event AgentDeactivated(uint256 indexed agentId , address indexed owner , uint256 time);
    event PriceUpdated(uint256 indexed agentId , uint256 oldPrice , uint256 newPrice , uint256 time );
    event AgentReactivated(uint256 indexed agentId, address indexed owner, uint256 time);

    error EmptyName();
    error EmptyEndpoint();
    error ZeroPrice();
    error EmptyURI();
    error AgentNotFound();
    error ZeroAddress();
    error NotOwnerOfAgent();
    error AlreadyDeactivated();
    error SamePrice();
    error AlreadyActive();


    constructor(address _identityRegistry) {
        if (_identityRegistry == address(0)) revert ZeroAddress();
        identityRegistry = IIdentityRegistry(_identityRegistry);
    }


    function register(string memory name, string memory endpoint, uint256 price, string memory agentURI) external returns(uint256 agentId){
        if (bytes(name).length==0) revert EmptyName();
        if (bytes(endpoint).length==0) revert EmptyEndpoint();      // WARNING: THE FRONTEND MUST VERIFY THE URL IS LEGIT  //
        if (price==0) revert ZeroPrice();                           //cannot be <0 as it is uint and in this version of Solidity it would revert negative inputs as uints//
        if (bytes(agentURI).length==0) revert EmptyURI();
        agentId = identityRegistry.register(agentURI);
        agents[agentId] = Agent({agentId : agentId , name : name , endpoint : endpoint , price : price , owner : msg.sender , active : true});
        ownerAgents[msg.sender].push(agentId);
        allAgentIds.push(agentId);
        activeAgentsCounter += 1 ; 
        emit AgentRegistered(agentId,name,msg.sender,price);
    }


    function getAgentsByOwner(address owner) external view returns (uint256[] memory){
        if (owner == address(0)) revert ZeroAddress();
        return ownerAgents[owner];
    }


    function deactivateAgent(uint256 agentId) external {
        Agent storage agent = agents[agentId];
        if (agent.owner==address(0)) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotOwnerOfAgent();
        if (agent.active == false) revert AlreadyDeactivated();
        agent.active = false;
        activeAgentsCounter -= 1 ; 
        emit AgentDeactivated(agentId,msg.sender,block.timestamp);
    }  


    function reactivateAgent (uint256 agentId) external { 
        Agent storage agent = agents[agentId];
        if (agent.owner == address(0)) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotOwnerOfAgent();
        if (agent.active == true) revert AlreadyActive();
        agent.active=true;
        activeAgentsCounter += 1 ; 
        emit AgentReactivated(agentId,msg.sender,block.timestamp); 
    }


    function updatePrice(uint256 agentId,uint256 newPrice) external {
        Agent storage agent = agents[agentId];
        if (agent.owner==address(0)) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotOwnerOfAgent();
        if (agent.price == newPrice) revert SamePrice();
        if (newPrice==0) revert ZeroPrice();
        uint256 oldPrice = agent.price;
        agent.price = newPrice;
        emit PriceUpdated(agentId,oldPrice,newPrice,block.timestamp);
    }



    function getAgent(uint256 agentId) external view returns (Agent memory){
        if (agents[agentId].owner == address(0)) revert AgentNotFound();
        return agents[agentId];
    }

    function totalAgents() external view returns(uint256) {
        return allAgentIds.length;                          // returns ALL agents ever registered, including inactive ones //
    }

}