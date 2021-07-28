//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";

contract ChainportSupplyManager is Initializable, ChainportMiddleware {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    mapping(address => uint256) public fundingAmountByBridgeAsset;
    mapping(address => address) public signerByBridgeAsset;
    mapping(address => address) public bridgeAssetBySigner;
    mapping(date => asset => counter) rebalancingPerAssetPerDay;

    address public bridgeProxyAddress;


    event TokensClaimed(address tokenAddress, address issuer, uint256 amount);

    modifier isBridgeNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    modifier isAmountGreaterThanZero(uint256 amount) {
        require(amount > 0, "Error: Amount is not greater than zero.");
        _;
    }

    modifier isAssetNotFrozen(address asset) {
        require(!isAssetFrozen[asset], "Error: Asset is frozen.");
        _;
    }

    // Initialization function
    function initialize(
        address _bridgeProxyAddress
    )
    public
    initializer
    {
        bridgeProxyAddress = _bridgeProxyAddress;
    }

    function updateFundingAmount(
        address bridgeAsset,
        uint256 newAmount
    )
    public
    onlyChainportCongress
    {
        uint256 memory oldAmount = fundingAmountByBridgeAsset[bridgeAsset];
        fundingAmountByBridgeAsset[bridgeAsset] = newAmount;
        emit FundingAmountChanged(bridgeAsset, oldAmount, newAmount);
    }

    function updateBridgeAssetSigner(
        address bridgeAssetAddress,
        address newAssetSigner
    )
    public
    onlyChainportCongress
    {
        address memory oldAssetSigner = signerByBridgeAsset[bridgeAssetAddress];
        signerByBridgeAsset[bridgeAssetAddress] = newAssetSigner;
        tokenBySigner[newAssetSigner] = bridgeAssetAddress;
        tokenBySigner[oldAssetSigner] = 0;

        emit SignerChanged(bridgeAssetAddress, oldAssetSigner, newAssetSigner);
    }


    function setBridgeContract(
        address newBridgeProxyAddress
    )
    public
    onlyChainportCongress
    {
        address memory oldBridgeProxyAddress = bridgeProxyAddress;
        bridgeProxyAddress = newBridgeProxyAddress;
        emit BridgeProxyAddressChanged(oldBridgeProxyAddress, newBridgeProxyAddress);
    }


    function fundBridge(
    ) public
    onlyRebalancer
    {
        token = tokenBySigner[address(msg.sender)];
        uint256 memory fundingAmount = fundingAmountByBridgeAsset[address(token)];
        IERC20(token).safeTransferFrom(address(msg.sender), address(bridgeProxyAddress), fundingAmount);

        emit BridgeFunded(token, msg.sender, bridgeProxyAddress);
    }
}
