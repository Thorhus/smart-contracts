//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

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
    // Booleans
    bool isContractFrozen;
    // Uints
    uint8 public dailyTransferLimit;
    // Addresses
    address _safeAddress;
    address public rebalancer;
    address public chainportBridge;
    address [] public tokensList;
    // Mappings
    mapping(address => uint256) tokenAddressToThreshold;
    mapping(address => uint256) tokenAddressToDailyLimit;
    mapping(address => uint256) tokenAddressToTransferTimestamp;
    mapping(address => uint16) tokenAddressToDailyTransfer;

    // Events
    // Global state variable value change
    event RebalancerChanged(address newRebalancer);
    event SafeAddressChanged(address newSafeAddress);
    event ChainportBridgeChanged(address newChainportBridge);
    // Fund rebalancing
    event FundsRebalancedToHotBridge(address token, uint256 amount);
    event FundsRebalancedToSafeAddress(address token, uint256 amount);
    // Token related
    event TokenThresholdSet(address token, uint256 threshold);
    event TokenAddedToList(address token);
    event TokenTransferedToSafety(address token);

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
        address safeAddress_,
        uint8 _dailyTransferLimit
    )
    public{
        setCongressAndMaintainers(_chainportCongress, _maintainersRegistry);
        rebalancer = _rebalancer;
        chainportBridge = _chainportBridge;
        _safeAddress = safeAddress_;
        dailyTransferLimit = _dailyTransferLimit;
    }

    // Functions
    // Function to get safeAddress by rebalancer
    function getSafeAddress() external onlyRebalancer view returns (address) {
        return _safeAddress;
    }

    // Set daily transfer limit per token
    function setDailyTransferLimit(
        uint8 _dailyTransferLimit
    )
    public
    onlyChainportCongress
    {
        require(_dailyTransferLimit != 0, "Error: Zero cannot be set as daily transfer limit.");
        dailyTransferLimit = _dailyTransferLimit;
    }

    // Function to set rebalancer by congress
    function setRebalancer(
        address _rebalancer
    )
    external
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

    // Function to set chainportBridge address by congress
    function setChainportBridge(
        address _chainportBridge
    )
    external
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
    external
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

    // Function to set token threshold by rebalancer
    function setTokenThresholdByRebalancer(
        address token,
        uint256 threshold
    )
    external
    onlyRebalancer
    {
        // Require that threshold has not been set
        require(tokenAddressToThreshold[token] == 0, "Error: Token threshold already set.");
        require(threshold > 0, "Error: Threshold cannot be set as zero value.");
        // Set threshold for token
        tokenAddressToThreshold[token] = threshold;
        // Emit an event
        emit TokenThresholdSet(token, threshold);
    }

    // Function to set thresholds for tokens
    function setTokenThresholdsByCongress(
        address [] calldata tokens,
        uint256 [] calldata thresholds
    )
    external
    onlyChainportCongress
    {
        for(uint16 i; i < tokens.length; i++) {
            // Require that array arguments are valid
            require(tokens[i] != address(0), "Error: Token address is malformed.");
            require(thresholds[i] != 0, "Error: Zero value cannot be set as threshold.");
            // Set threshold for token
            tokenAddressToThreshold[tokens[i]] = thresholds[i];
            // Emit an event
            emit TokenThresholdSet(tokens[i], thresholds[i]);
        }
    }

    // Function to set tokensList by congress
    function setTokensList(
        address [] calldata tokens
    )
    external
    onlyChainportCongress
    {
        // Set the new token addresses
        for(uint16 i; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Error: TokenAddress is malformed.");
            tokensList[i] = tokens[i];
            emit TokenAddedToList(tokens[i]);
        }
        // Check if there is a leftover and override it with zero address
        if(tokens.length < tokensList.length) {
            for(uint16 i = uint16(tokens.length); i < tokensList.length; i++) {
                tokensList[i] = address(0);
            }
        }
    }

    // Function to transfer funds to bridge contract
    function fundBridgeByRebalancer(
        address [] calldata tokens,
        uint256 [] calldata amounts
    )
    external
    onlyRebalancer
    {
        for(uint16 i; i < tokens.length; i++) {
            // Require that valid amount is given
            require(
                amounts[i] > 0 && amounts[i] <= tokenAddressToThreshold[tokens[i]],
                "Error: Amount is not valid."
            );
            // Set the timestamp for the token (86400 == 1 day)
            if(tokenAddressToTransferTimestamp[tokens[i]] < block.timestamp - 86400) {
                tokenAddressToTransferTimestamp[tokens[i]] = block.timestamp;
                tokenAddressToDailyTransfer[tokens[i]] = 0;
            }
            // Require that transfer limit for token hasn't been reached in past 24hrs
            require(
                tokenAddressToDailyTransfer[tokens[i]] < dailyTransferLimit,
                "Error: Daily transfer limit has been reached."
            );
            // Increase tokenAddressToDailyTransfer for token
            tokenAddressToDailyTransfer[tokens[i]] = uint16(tokenAddressToTransferTimestamp[tokens[i]].add(1));
            // Perform safe transfer
            IERC20(tokens[i]).safeTransfer(chainportBridge, amounts[i]);
            emit FundsRebalancedToHotBridge(tokens[i], amounts[i]);
        }
    }

    // Function to transfer funds to the safe address
    function fundSafeByRebalancer(
        address [] calldata tokens,
        uint256 [] calldata amounts
    )
    external
    onlyRebalancer
    {
        for(uint16 i; i < tokens.length; i++) {
            // Require that valid amount is given
            require(amounts[i] > 0, "Error: Amount is not greater than zero.");
            // Perform safe transfer
            IERC20(tokens[i]).safeTransfer(_safeAddress, amounts[i]);
            emit FundsRebalancedToSafeAddress(tokens[i], amounts[i]);
        }
    }

    // Function to transfer all funds to the safe address in case of emergency
    function emergencyWithdraw()
    public
    onlyChainportCongress
    {
        for(uint16 i; i < tokensList.length; i++) {
            // Get contract balance of specific token
            uint256 fullBalance = IERC20(tokensList[i]).balanceOf(address(this));
            // Perform the safe transfer
            IERC20(tokensList[i]).safeTransfer(_safeAddress, fullBalance);
            emit TokenTransferedToSafety(tokensList[i]);
        }
    }
}
