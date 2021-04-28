pragma solidity ^0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import "./MaintainersRegistry.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

contract ChainportBridgeEth is Initializable{

    mapping(address => uint) public balancesByAddresses;
    // Mapping for marking the assets
    mapping(address => bool) isProtected;
    // Mapping for setting time locks
    mapping(address => uint) timeLock;
    // Mapping for congress approval
    mapping(address => bool) isApprovedByCongress;

    uint private needsToBeDelayedThreshold; // Set value;
    uint private constant TIMELOCK = 2 days; // Length of time lock

    address MaintainersRegistryAddress;

    event TokensUnfreezed(address tokenAddress, address issuer, uint amount);
    event TokensFreezed(address tokenAddress, address issuer, uint amount);

    modifier onlyMaintainer {
        require(MaintainersRegistry(MaintainersRegistryAddress).isMaintainer(msg.sender));
        _;
    }

    modifier onlyChainportCongress {
        require(msg.sender == MaintainersRegistry(MaintainersRegistryAddress).chainportCongress());
        _;
    }

    // Initialization function
    function initialize(address _maintainersRegistryAddress) public initializer {
        MaintainersRegistryAddress = _maintainersRegistryAddress;
    }

    // Function used to mark assets as protected
    function protectAssets(address token) internal onlyMaintainer {
        // Mark the assets
        isProtected[address(token)] = true;
    }

    // Function to set a time lock on specified asset
    function setTimeLock(address token) internal onlyMaintainer {
        // Secure assets with time lock
        timeLock[address(token)] = block.timestamp + TIMELOCK;
    }

    // Function to approve token release
    function approve(address token) internal onlyChainportCongress {
        isApprovedByCongress[address(token)] = true;
        timeLock[address(token)] = 0;
    }

    // Function to reset asset state
    function resetAssetState(address token) internal {
        isApprovedByCongress[address(token)] = false;
    }

    function freezeToken(address token, uint256 amount) public payable {
        IERC20 ercToken = IERC20(token);

        ercToken.transferFrom(address(msg.sender), address(this), amount);

        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)] + amount;

        emit TokensFreezed(token, msg.sender, amount);
    }

    function releaseTokens(address token, address receiver, uint amount) public {
        require(balancesByAddresses[address(token)] >= amount, "ChainportBridgeEth :: Not enough funds");

        // Check if assets are protected, amount is considered important by its quantity and congress has not approved the release
        if(isProtected[address(token)] && amount >= needsToBeDelayedThreshold && !isApprovedByCongress[address(token)]){
            // Set the time lock
            setTimeLock(token);
        }

        // Require that assets are either approved by the congress or time-lock is ended
        require(block.timestamp > timeLock[address(token)], "ChainportBridgeEth :: Congress must approve token release");

        IERC20 ercToken = IERC20(token);
        ercToken.transfer(address(receiver), amount);
        balancesByAddresses[address(token)] = balancesByAddresses[address(token)] - amount;

        // This line is for securing that approval serves only for one transaction
        resetAssetState(token);

        emit TokensUnfreezed(token, msg.sender, amount);
    }
}
