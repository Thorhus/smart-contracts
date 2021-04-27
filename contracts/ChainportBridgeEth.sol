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

    uint private needsToBeDelayedThreshold; // Set value;
    uint private constant TIMELOCK = 2 days; // Length of time lock

    address MaintainersRegistryAddress;

    event TokensUnfreezed(address tokenAddress, address issuer, uint amount);
    event TokensFreezed(address tokenAddress, address issuer, uint amount);

    modifier onlyMaintainer{
        require(MaintainersRegistry(MaintainersRegistryAddress).isMaintainer(msg.sender));
        _;
    }

    function initialize(address _maintainersRegistryAddress) public initializer{
        MaintainersRegistryAddress = _maintainersRegistryAddress;
    }

    // Lock mechanism
    function lockAssets(address token) internal onlyMaintainer{
        // Mark the assets
        isProtected[token] = true;
    }

    function setTimeLock(address token) internal onlyMaintainer{
        // Secure assets with time lock
        timeLock[token] = block.timestamp + TIMELOCK;
    }

    function freezeToken(address token, uint256 amount) public payable{
        IERC20 ercToken = IERC20(token);

        ercToken.transferFrom(address(msg.sender), address(this), amount);

        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)] + amount;

        emit TokensFreezed(token, msg.sender, amount);
    }

    function releaseTokens(address token, address receiver, uint amount) public {
        require(balancesByAddresses[address(token)] >= amount, "ChainportBridgeEth :: Not enough funds");

        // Check if assets are marked and if amount is big enough
        if(isProtected[token] && amount >= needsToBeDelayedThreshold){
            setTimeLock(token);
        }

        require(block.timestamp > timeLock[token], "ChainportBridgeEth :: Cannot perform transaction under time lock");

        IERC20 ercToken = IERC20(token);
        ercToken.transfer(address(receiver), amount);
        balancesByAddresses[address(token)] = balancesByAddresses[address(token)] - amount;
        emit TokensUnfreezed(token, msg.sender, amount);
    }
}
