pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "./libraries/SafeMath.sol";
import "./interfaces/IMaintainersRegistry.sol";

contract ChainportBridgeEth is Initializable {

    using SafeMath for uint;

    address public chainportCongress;
    IMaintainersRegistry public maintainersRegistry;

    // Mapping for marking the assets
    mapping(address => bool) isProtected;
    // Mapping for setting time locks
    mapping(address => uint) timeLock;
    // Mapping for congress approval
    mapping(address => bool) isApprovedByCongress;


    //TODO: Make it configurable from congress
    uint private safetyThreshold;

    //TODO: Make it configurable from congress
    uint private constant TIMELOCK = 2 days;

    // Events
    event TokensUnfreezed(address tokenAddress, address issuer, uint amount);
    event TokensFreezed(address tokenAddress, address issuer, uint amount);
    event TimeLockSet(address tokenAddress, address issuer, uint amount, uint startTime, uint endTime);
    event ApprovedByChainportCongress(address tokenAddress, uint time);

    // Only maintainer modifier
    modifier onlyMaintainer {
        require(maintainersRegistry.isMaintainer(msg.sender), "Error: Restricted only to Maintainer");
        _;
    }

    // Only chainport congress modifier
    modifier onlyChainportCongress {
        require(msg.sender == chainportCongress, "Error: Restricted only to ChainportCongress");
        _;
    }

    // Initialization function
    function initialize(
        address _maintainersRegistryAddress,
        address _chainportCongress
    )
    public
    initializer
    {
        maintainersRegistry = IMaintainersRegistry(_maintainersRegistryAddress);
        chainportCongress = _chainportCongress;
    }

    // Function used to mark asset as protected
    function setAssetProtection(address tokenAddress, bool _isProtected) public onlyMaintainer {
        isProtected[tokenAddress] = _isProtected;
    }

    // Function to set a time lock on specified asset
    function setTimeLock(address token, uint amount) internal {
        // Secure assets with time lock
        timeLock[address(token)] = block.timestamp + TIMELOCK;
        emit TimeLockSet(token, msg.sender, amount, block.timestamp, timeLock[address(token)]);
    }

    // Function to set minimal value that is considered important by quantity
    function setThreshold(uint _safetyThreshold) public onlyChainportCongress {
        // This is representing % of every asset on the contract
        // Example: 32% is safety threshold
        safetyThreshold = _safetyThreshold;
    }

    // Function to approve token release
    function approve(address token) public onlyChainportCongress {
        isApprovedByCongress[address(token)] = true;
        timeLock[address(token)] = now;
        emit ApprovedByChainportCongress(address(token), now);
    }

    // Function to reset asset state
    function resetAssetState(address token) internal {
        isApprovedByCongress[address(token)] = false;
        timeLock[address(token)] = 0;
    }

    function freezeToken(address token, uint256 amount) public {
        IERC20 ercToken = IERC20(token);
        ercToken.transferFrom(address(msg.sender), address(this), amount);
        emit TokensFreezed(token, msg.sender, amount);
    }

    function releaseTokens(bytes memory signature, address token, uint amount) public {
        //todo: Add check that bridge has >= amount of tokens on it's wallet
        //todo: receiver = msg.sender
        //todo: Add an option that maintainer can call this function and submit receiver
        //todo: do the math that if amount >= safetyThreshold * balance(token) / 100
        //todo: If user tries to withdraw more than x tokens of protected asset which is not approved by congress,
        //todo: contract should set a timelock of N hours
        //todo: Congress should come and remove that timelock and approve the withdrawal, should in the same transaction
        //todo: transfer the funds to the user
        //todo: releaseTokens (attempt by user)
        //todo: approveWithdrawalForUser(attempt by congress)
        // Check if assets are protected, amount is considered important by its quantity and congress has not approved the release

        if(isProtected[address(token)] && amount >= safetyThreshold && !isApprovedByCongress[address(token)]) {
            // Set the time lock
            if(timeLock[address(token)] == 0) {
                setTimeLock(token, amount);
            }
        }

        // Require that assets are either approved by the congress or time-lock is ended
        require(block.timestamp > timeLock[address(token)], "ChainportBridgeEth :: Congress must approve token release");

        IERC20 ercToken = IERC20(token);
        ercToken.transfer(address(receiver), amount);

        // This line is for securing that approval serves only for one transaction
        resetAssetState(token);

        emit TokensUnfreezed(token, msg.sender, amount);
    }
}
