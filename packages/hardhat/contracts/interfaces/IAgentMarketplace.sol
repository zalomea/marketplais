// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

interface IAgentMarketplace {
    struct Agent {
        uint256 agentId;
        string name;
        string endpoint;
        uint256 price;
        address owner;
        bool active;
    }
    function getAgent(uint256 agentId) external view returns (Agent memory);
}