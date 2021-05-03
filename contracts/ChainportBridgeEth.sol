pragma solidity ^0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

import "./libraries/SafeMath.sol";
import "./interfaces/IMaintainersRegistry.sol";

contract ChainportBridgeEth is Initializable {

    using SafeMath for uint;

    address public chainportCongress;
    IMaintainersRegistry public maintainersRegistry;

    mapping(address => uint) public balancesByAddresses;
    // Mapping for marking the assets
    mapping(address => bool) isProtected;
    // Mapping for setting time locks
    mapping(address => uint) timeLock;
    // Mapping for congress approval
    mapping(address => bool) isApprovedByCongress;

    uint private safetyThreshold;
    uint private timeLockLength;

    // Events
    event TokensUnfreezed(address tokenAddress, address issuer, uint amount);
    event TokensFreezed(address tokenAddress, address issuer, uint amount);
    event TimeLockSet(address tokenAddress, address issuer, uint amount, uint startTime, uint endTime);
    event ApprovedByChainportCongress(address tokenAddress, uint time);

    // Only maintainer modifier
    modifier onlyMaintainer {
        require(maintainersRegistry.isMaintainer(msg.sender));
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
    function protectAsset(address token) public onlyMaintainer {
        // Mark the asset
        isProtected[address(token)] = true;
    }

    // Function to set a time lock on specified asset
    function setTimeLock(address token, uint amount) internal {
        // Secure assets with time lock
        timeLock[address(token)] = block.timestamp + timeLockLength;
        emit TimeLockSet(token, msg.sender, amount, block.timestamp, timeLock[address(token)]);
    }

    // Function to set length of the time lock
    function setTimeLockLength(uint _timeLockLength) public onlyMaintainer{
        timeLockLength = _timeLockLength;
    }

    // Function to set minimal value that is considered important by quantity
    function setThreshold(uint _safetyThreshold) public onlyMaintainer{
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

    function freezeToken(address token, uint256 amount) public payable {
        IERC20 ercToken = IERC20(token);

        ercToken.transferFrom(address(msg.sender), address(this), amount);

        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)].add(amount);

        emit TokensFreezed(token, msg.sender, amount);
    }

    function releaseTokens(address token, address receiver, uint amount) public {
        require(balancesByAddresses[address(token)] >= amount, "ChainportBridgeEth :: Not enough funds");

        // Check if assets are protected, amount is considered important by its quantity and congress has not approved the release
        if(isProtected[address(token)] && amount >= safetyThreshold && !isApprovedByCongress[address(token)]) {
            // Set the time lock
            if(timeLock[address(token)] == 0){
                setTimeLock(token, amount);
            }
        }

        // Require that assets are either approved by the congress or time-lock is ended
        require(block.timestamp > timeLock[address(token)], "ChainportBridgeEth :: Congress must approve token release");

        IERC20 ercToken = IERC20(token);
        ercToken.transfer(address(receiver), amount);
        balancesByAddresses[address(token)] = balancesByAddresses[address(token)].sub(amount);

        // This line is for securing that approval serves only for one transaction
        resetAssetState(token);

        emit TokensUnfreezed(token, msg.sender, amount);
    }
}
