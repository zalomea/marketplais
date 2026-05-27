// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

interface IIdentityRegistry{
    function register(string memory agentURI) external returns(uint256 agentId);
    function ownerOf(uint256 agentId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);
    function getAgentWallet(uint256 agentId) external view returns (address); 
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}