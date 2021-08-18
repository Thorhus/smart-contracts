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
    address public bridgeContract;

    // Events
    event RebalancerChanged(address newRebalancer);
    event FundsRebalancedToHotBridge(address token, uint256 amount);

    // Modifiers
    modifier onlyRebalancer {
        require(
            msg.sender == rebalancer,
            "Error: Function restricted only to rebalancer."
        );
        _;
    }

    modifier isContractNotFrozen {
        require(!isContractFrozen, "Error: Contract is frozen.");
        _;
    }

    constructor(
        address _chainportCongress,
        address _maintainersRegistry,
        address _rebalancer,
        address _bridgeContract
    )
    public{
        setCongressAndMaintainers(_chainportCongress, _maintainersRegistry);
        rebalancer = _rebalancer;
        bridgeContract = _bridgeContract;
    }

    // Functions
    // Function to set rebalancer by congress
    function setRebalancer(
        address _rebalancer
    )
    public
    onlyChainportCongress
    isContractNotFrozen
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

    // Function to transfer funds to bridge contract under right conditions
    function fundBridge(
        address token,
        uint256 amount
    )
    public
    onlyRebalancer
    isContractNotFrozen
    {
        // Check that amount is greater than zero
        require(amount > 0, "Error: Amount is not greater than zero.");

        // Get contract balances
        uint256 bridgeBalance = IERC20(token).balanceOf(bridgeContract);
        uint256 fundManagerBalance = IERC20(token).balanceOf(address(this));

        // Require that only limited percent of the token resources will be available on bridge after transfer
        require(
            bridgeBalance.add(amount) < fundManagerBalance.add(bridgeBalance).div(100).mul(threshold),
            "Error: Amount is over limit."
        );

        // Perform safe transfer
        IERC20(token).safeTransfer(bridgeContract, amount);
        emit FundsRebalancedToHotBridge(token, amount);
    }

}
