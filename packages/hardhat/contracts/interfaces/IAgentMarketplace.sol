// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { IIdentityRegistry } from "./IIdentityRegistry.sol";

interface IAgentMarketplace {
    struct Agent {
        address owner;
        uint256 agentId;
        uint256 price;
        uint256 nonce;
        bool payToAgentWallet;
        bool active;
    }

    struct AgentFullDetails {
        Agent agent;
        address owner;
        string uri;
    }

    function getAgent(uint256) external view returns (Agent memory);
    function getAgentFullDetails(uint256) external view returns (AgentFullDetails memory);
    function getAgentsFullPaginated(uint256 page, uint256 count) external view returns (AgentFullDetails[] memory);
    function getAgentsByOwner(address agentOwner) external view returns (AgentFullDetails[] memory);
    function identityRegistry() external view returns (IIdentityRegistry);
}
