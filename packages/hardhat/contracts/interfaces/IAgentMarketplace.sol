// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IIdentityRegistry} from "./IIdentityRegistry.sol";

interface IAgentMarketplace {
    struct Agent {
        uint256 agentId;
        uint256 price;
        bool payToAgentWallet; 
        bool active;
    }
    function getAgent(uint256) external view returns (Agent memory);
    function identityRegistry() external view returns (IIdentityRegistry);
}