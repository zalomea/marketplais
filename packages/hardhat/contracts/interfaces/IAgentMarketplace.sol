// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

interface IAgentMarketplace {
    struct Agent {
        uint256 agentId;
        uint256 price;
        bool payToAgentWallet; 
        bool active;
    }
}