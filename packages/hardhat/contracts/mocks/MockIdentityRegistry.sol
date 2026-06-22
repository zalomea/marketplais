// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title MockIdentityRegistry
 * @dev Minimal ERC-721 registry for testing AgentMarketplace resilience.
 *      Supports minting via register() and burning via burn(), matching the
 *      subset of IIdentityRegistry functions that AgentMarketplace calls.
 */
contract MockIdentityRegistry is ERC721 {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    uint256 private _lastId;
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC721("AgentIdentity", "AGENT") {}

    function register(string memory agentURI) external returns (uint256 agentId) {
        return _register(agentURI);
    }

    function register(string memory agentURI, MetadataEntry[] memory) external returns (uint256 agentId) {
        return _register(agentURI);
    }

    function _register(string memory agentURI) internal returns (uint256 agentId) {
        agentId = _lastId++;
        _safeMint(msg.sender, agentId);
        _tokenURIs[agentId] = agentURI;
    }

    function burn(uint256 agentId) external {
        address tokenOwner = ownerOf(agentId);
        require(_isAuthorized(tokenOwner, msg.sender, agentId), "Not authorized");
        _burn(agentId);
        delete _tokenURIs[agentId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    function getAgentWallet(uint256) external pure returns (address) {
        return address(0);
    }

    function setAgentWallet(uint256, address, uint256, bytes calldata) external pure {
        revert("not implemented");
    }

    function unsetAgentWallet(uint256) external pure {
        revert("not implemented");
    }

    function getMetadata(uint256, string memory) external pure returns (bytes memory) {
        return "";
    }

    function setMetadata(uint256, string memory, bytes memory) external pure {
        revert("not implemented");
    }

    function setAgentURI(uint256, string calldata) external pure {
        revert("not implemented");
    }
}
