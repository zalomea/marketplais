// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import { IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

/**
 * @title IIdentityRegistry
 * @dev Interface for the ERC-8004 Identity Registry.
 * It manages agent identities as portable and transferable ERC-721 tokens.
 */
interface IIdentityRegistry is IERC721Metadata {
    /**
     * @dev Metadata structure as defined in the source code.
     */
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    // --- Events ---

    event AgentRegistered(uint256 indexed agentId, address indexed owner);
    event AgentURIUpdated(uint256 indexed agentId, string uri);
    event MetadataUpdated(uint256 indexed agentId, string indexed key, bytes value);
    event AgentWalletUpdated(uint256 indexed agentId, address indexed newWallet);

    // --- Registration Methods (The 3 Variants) ---

    /**
     * @notice Basic registration. Mints an agent NFT to the caller.
     */
    function register() external returns (uint256 agentId);

    /**
     * @notice Registers an agent and sets the initial agentURI (tokenURI).
     * @param uri The URI pointing to the agent's registration JSON file.
     */
    function register(string calldata uri) external returns (uint256 agentId);

    /**
     * @notice Registers an agent, sets the URI, and initializes on-chain metadata.
     * @param uri The initial registration file URI.
     * @param metadata Initial metadata entries for the agent.
     */
    function register(string calldata uri, MetadataEntry[] calldata metadata) external returns (uint256 agentId);

    // --- Agent URI Management ---

    /**
     * @notice Updates the agent's registration file URI (tokenURI).
     */
    function setAgentURI(uint256 agentId, string calldata uri) external;

    // --- Metadata Management ---

    /**
     * @notice Retrieves the raw bytes value of a metadata key for an agent.
     */
    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory);

    /**
     * @notice Sets a single on-chain metadata value.
     */
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external;

    // --- Agent Wallet Management ---

    /**
     * @notice Gets the verified wallet address associated with the agent.
     */
    function getAgentWallet(uint256 agentId) external view returns (address);

    /**
     * @notice Updates the verified wallet using an EIP-712 or ERC-1271 signature.
     * @dev This wallet is cleared automatically upon NFT transfer.
     */
    function setAgentWallet(uint256 agentId, address newWallet, uint256 expiry, bytes calldata signature) external;

    /**
     * @notice Manually removes the verified wallet association.
     */
    function unsetAgentWallet(uint256 agentId) external;

    /**
     * @notice Returns the EIP-712 domain separator information.
     */
    function eip712Domain()
        external
        view
        returns (
            bytes1 fields,
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract,
            bytes32 salt,
            uint256[] memory extensions
        );
}
