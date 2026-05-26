// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import "./interfaces/IIdentityRegistry.sol";
import "./interfaces/IAgentMarketplace.sol";
import "./interfaces/IERC20.sol";

contract MarketplaceRouter{

    IAgentMarketplace public agentMarketplace;
    IIdentityRegistry public identityRegistry;
    IERC20 public token;
    uint256 public accumulatedFees; // The sumatory of fees the contract has therefore the minimun amount of USDC the contract should have //
    uint256 public feeBps;          //will be the fee amount in basis points , meaning 1% = 100 or 15% = 1500//
    address public owner ;
    address public pendingOwner ; 
    address public treasury ;       // The address that will hold the funds. By using a different one we decentralize the power of the contract so if someone manages to take control of the owner he doesn´t steal the funds. //

    error AgentNotActive();
    error NotOwner();
    error NoFeesToWithdraw();
    error ZeroAddress();
    error ZeroPrice();
    error FeeTooHigh();
    error SameOwner();
    error SameFeeBps();
    error TransferFailed();

    event PaymentRouted(address indexed client, uint256 indexed agentId, uint256 amount);
    event FeesWithdrawn(uint256 tokenAmount , uint256 time ); 
    event OwnerTransferred(address indexed oldOwner,address indexed newOwner, uint256 time);
    event FeeBpsUpdated (uint256 oldFeeBps , uint256 newFeeBps,uint256 time);


    modifier onlyOwner(){
        if (msg.sender != owner) revert NotOwner();
        _;
    }


    constructor (address _identityRegistry ,address _agentMarketplace, address _token , uint256 _feeBps , address _treasury) {
        if (_treasury == address(0)) revert ZeroAddress();
        if (_identityRegistry == address(0)) revert ZeroAddress();
        if (_agentMarketplace == address(0)) revert ZeroAddress();
        if (_token == address(0)) revert ZeroAddress();
        //the max fee percentage alloweed is 10%
        if (_feeBps > 1000) revert FeeTooHigh();                    
        treasury = _treasury;
        agentMarketplace = IAgentMarketplace(_agentMarketplace); 
        identityRegistry = IIdentityRegistry(_identityRegistry) ;
        token = IERC20(_token);
        //it is possible for the deployer to use 0 fees
        feeBps = _feeBps;                                           
        owner = msg.sender;
    }

    //Be aware of Frontrunning risk //
    //Price can change between approval and payment calling updatePrice on AgentMarketplace.sol. Frontend should verify price hasn't changed before calling pay() //
    function pay(uint256 agentId) external {
        IAgentMarketplace.Agent memory agent = agentMarketplace.getAgent(agentId); 
        if (!agent.active) revert AgentNotActive();
        address agentwallet = identityRegistry.getAgentWallet(agentId);
        if (agentwallet == address(0)) revert ZeroAddress();
        uint256 priceWithoutFees = agent.price;
        if (priceWithoutFees == 0 ) revert ZeroPrice();
        uint256 fee = (priceWithoutFees * feeBps)/10000;
        uint256 totalPrice = priceWithoutFees + fee;
        accumulatedFees += fee;
        if (fee > 0){         
            bool success = token.transferFrom(msg.sender,address(this),fee);
            if (!success) revert TransferFailed();
        }
        bool success2 = token.transferFrom(msg.sender,agentwallet,priceWithoutFees);
        if (!success2) revert TransferFailed();
        emit PaymentRouted(msg.sender, agentId, totalPrice);
    }



    function withdrawFees() external onlyOwner{
        if (accumulatedFees == 0 ) revert NoFeesToWithdraw();
        uint256 tokenAmount = accumulatedFees;
        accumulatedFees=0;
        bool success = token.transfer(treasury,tokenAmount);
        if (!success) revert TransferFailed();
        emit FeesWithdrawn(tokenAmount,block.timestamp);
    }

    //To transfer ownership of the marketplace there is a two-step verification. First the actual owner approves a new address and then this new//
    //address has to call acceptOwnership. this prevents commiting mistakes, and brings extra security in a crticial process. //

    function transferOwnership (address newOwner) external onlyOwner{
        if (newOwner == owner) revert SameOwner();
        pendingOwner = newOwner;
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotOwner();
        emit OwnerTransferred(owner,pendingOwner,block.timestamp);
        owner=pendingOwner;
        pendingOwner = address(0) ; 
    }

    //Be aware of Frontrunning risk //
    //Fees can change between approval and payment. Frontend should verify fees hasn't changed before calling pay() //
    function updateFeeBps (uint256 newFeeBps) external onlyOwner{
        if (newFeeBps > 1000) revert FeeTooHigh();
        if (newFeeBps == feeBps) revert SameFeeBps();
        emit FeeBpsUpdated(feeBps, newFeeBps,block.timestamp);
        feeBps = newFeeBps;
    } 
    
}