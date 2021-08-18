//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./ChainportMiddleware.sol";

/**
 * ChainportFundManager contract.
 * @author Marko Lazic
 * Date created: 17.8.21.
 * Github: markolazic01
 */

contract ChainportFundManager is ChainportMiddleware {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Global state variables
    bool isContractFrozen;
    uint8 public threshold;
    address public rebalancer;
    address public chainportBridge;
    address _safeAddress;
    mapping(address => uint256) tokenAddressToThreshold;

    // Events
    event RebalancerChanged(address newRebalancer);
    event SafeAddressChanged(address newSafeAddress);
    event ChainportBridgeChanged(address newChainportBridge);
    event FundsRebalancedToHotBridge(address token, uint256 amount);
    event FundsRebalancedToSafeAddress(address token, uint256 amount);
    event TokenThresholdSet(address token, uint256 threshold);

    // Modifiers
    modifier onlyRebalancer {
        require(
            msg.sender == rebalancer,
            "Error: Function restricted only to rebalancer."
        );
        _;
    }

    constructor(
        address _chainportCongress,
        address _maintainersRegistry,
        address _rebalancer,
        address _chainportBridge,
        address safeAddress_
    )
    public{
        setCongressAndMaintainers(_chainportCongress, _maintainersRegistry);
        rebalancer = _rebalancer;
        chainportBridge = _chainportBridge;
        _safeAddress = safeAddress_;
    }

    // Functions
    // Function to set rebalancer by congress
    function setRebalancer(
        address _rebalancer
    )
    public
    onlyChainportCongress
    {
        // Require that address is not malformed
        require(
            _rebalancer != address(0),
            "Error: Cannot set zero address as rebalancer."
        );

        // Set new rebalancer address
        rebalancer = _rebalancer;
        emit RebalancerChanged(_rebalancer);
    }

    function setChainportBridge(
        address _chainportBridge
    )
    public
    onlyChainportCongress
    {
        // Require that address is not malformed
        require(
            _chainportBridge != address(0),
            "Error: Cannot set zero address as bridge contract."
        );

        // Set new rebalancer address
        chainportBridge = _chainportBridge;
        emit ChainportBridgeChanged(_chainportBridge);
    }

    // Function to set safe address by congress
    function setSafeAddress(
        address safeAddress_
    )
    public
    onlyChainportCongress
    {
        // Require that address is not malformed
        require(
            safeAddress_ != address(0),
            "Error: Cannot set zero address as safe address."
        );

        // Set new safe address
        _safeAddress = safeAddress_;
        emit SafeAddressChanged(safeAddress_);
    }

    function setTokenThresholdsByCongress(
        address [] memory tokens,
        uint256 [] memory thresholds
    )
    public
    onlyChainportCongress
    {
        for(uint8 i; i < tokens.length; i++) {
            // Require that array arguments are valid
            require(tokens[i] != address(0), "Error: Token address is malformed.");
            require(thresholds[i] != 0, "Error: Zero value cannot be set as threshold.");
            // Set threshold for token
            tokenAddressToThreshold[tokens[i]] = thresholds[i];
            // Emit an event
            emit TokenThresholdSet(tokens[i], thresholds[i]);
        }
    }

    // Function to transfer funds to bridge contract under right conditions
    function fundBridge(
        address [] memory tokens,
        uint256 [] memory amounts
    )
    public
    onlyRebalancer
    {
        for(uint8 i; i < tokens.length; i++) {
            // Require that valid amount is given
            require(
                amounts[i] > 0 && amounts[i] <= tokenAddressToThreshold[tokens[i]],
                "Error: Amount is not valid."
            );
            // Perform safe transfer
            IERC20(tokens[i]).safeTransfer(chainportBridge, amounts[i]);
            emit FundsRebalancedToHotBridge(tokens[i], amounts[i]);
        }
    }

    function fundSafe(
        address [] memory tokens,
        uint256 [] memory amounts
    )
    public
    onlyRebalancer
    {
        for(uint8 i; i < tokens.length; i++) {
            // Require that valid amount is given
            require(amounts[i] > 0, "Error: Amount is not greater than zero.");
            // Perform safe transfer
            IERC20(tokens[i]).safeTransfer(_safeAddress, amounts[i]);
            emit FundsRebalancedToSafeAddress(tokens[i], amounts[i]);
        }
    }
}
