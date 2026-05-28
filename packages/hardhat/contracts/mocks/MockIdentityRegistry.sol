// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

/// @dev Minimal mock of the ERC-8004 IdentityRegistry for unit tests.
/// Implements only the functions called by AgentMarketplace and MarketplaceRouter.
contract MockIdentityRegistry is IIdentityRegistry {
    uint256 private _nextAgentId = 1;

    mapping(uint256 => address) private _owners;
    mapping(uint256 => address) private _agentWallets;

    /// @dev Mints the next agentId to the caller (AgentMarketplace), matching ERC-8004 behavior.
    function register(string memory /*agentURI*/) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _owners[agentId] = msg.sender;
        _agentWallets[agentId] = msg.sender;
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        return _owners[agentId];
    }

    function tokenURI(uint256 /*agentId*/) external pure returns (string memory) {
        return "";
    }

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentWallets[agentId];
    }

    /// @dev Simulates ERC-721 safeTransferFrom — updates the owner mapping.
    function safeTransferFrom(address /*from*/, address to, uint256 tokenId) external {
        _owners[tokenId] = to;
    }

    /// @dev Allows tests to override the agentWallet independently of the owner.
    function setAgentWallet(uint256 agentId, address wallet) external {
        _agentWallets[agentId] = wallet;
    }
}
