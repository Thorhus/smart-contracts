//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";

contract ChainportMainBridge is Initializable, ChainportMiddleware {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IValidator public signatureValidator;

    struct PendingWithdrawal {
        uint256 amount;
        address beneficiary;
        uint256 unlockingTime;
    }

    // Mapping if bridge is Frozen
    bool public isFrozen;
    // Mapping function name to maintainer nonce
    mapping(string => uint256) public functionNameToNonce;
    // Mapping the pending withdrawal which frozen temporarily asset circulation
    mapping(address => PendingWithdrawal) public tokenToPendingWithdrawal;
    // Mapping per token to check if there's any pending withdrawal attempt
    mapping(address => bool) public isTokenHavingPendingWithdrawal;
    // Mapping for marking the assets
    mapping(address => bool) public isAssetProtected;
    // Check if signature is being used
    mapping(bytes => bool) public isSignatureUsed;
    // % of the tokens, must be whole number, no decimals pegging
    uint256 public safetyThreshold;
    // Length of the timeLock
    uint256 public freezeLength;
    // Mapping for freezing the assets
    mapping(address => bool) public isAssetFrozen;

    // Network activity state mapping
    mapping(uint256 => bool) public isNetworkActive;

    // Nonce mapping
    mapping(bytes32 => bool) public isNonceUsed;

    // Mapping for freezing specific path: token -> functionName -> isPausedOrNot
    mapping(address => mapping(string => bool)) public isPathPaused;

    // Address of the FundManager contract
    address public fundManager;

    // Events
    event TokensClaimed(address tokenAddress, address issuer, uint256 amount);

    event AssetFrozen(address asset, bool isAssetFrozen);

    event NetworkActivated(uint256 networkId);
    event NetworkDeactivated(uint256 networkId);

    event TokensDeposited(address tokenAddress, address issuer, uint256 amount, uint256 networkId);

    event PathPauseStateChanged(address tokenAddress, string functionName, bool isPaused);

    event BridgeFreezed(bool isFrozen);

    event FundManagerChanged(address newFundManager);
    event FundsRebalanced(address target, address token, uint256 amount);

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

    modifier isPathNotPaused(
        address token,
        string memory functionName
    )
    {
        require(!isPathPaused[token][functionName], "Error: Path is paused.");
        _;
    }

    // Initialization function
    function initialize(
        address _maintainersRegistryAddress,
        address _chainportCongress,
        address _signatureValidator,
        uint256 _freezeLength,
        uint256 _safetyThreshold
    )
    public
    initializer
    {
        require(_safetyThreshold > 0 && _safetyThreshold < 100, "Error: % is not valid.");

        setCongressAndMaintainers(_chainportCongress, _maintainersRegistryAddress);
        signatureValidator = IValidator(_signatureValidator);
        freezeLength = _freezeLength;
        safetyThreshold = _safetyThreshold;
    }

    function freezeBridge()
    public
    onlyMaintainer
    {
        isFrozen = true;
        emit BridgeFreezed(true);
    }

    function unfreezeBridge()
    public
    onlyChainportCongress
    {
        isFrozen = false;
        emit BridgeFreezed(false);
    }

    function setAssetFreezeState(
        address tokenAddress,
        bool _isFrozen
    )
    public
    onlyChainportCongress
    {
        isAssetFrozen[tokenAddress] = _isFrozen;
        emit AssetFrozen(tokenAddress, _isFrozen);
    }

    function freezeAssetByMaintainer(
        address tokenAddress
    )
    public
    onlyMaintainer
    {
        isAssetFrozen[tokenAddress] = true;
        emit AssetFrozen(tokenAddress, true);
    }

    function setAssetProtection(
        address tokenAddress,
        bool _isProtected
    )
    public
    onlyChainportCongress
    {
        isAssetProtected[tokenAddress] = _isProtected;
    }

    function protectAssetByMaintainer(
        address tokenAddress
    )
    public
    onlyMaintainer
    {
        isAssetProtected[tokenAddress] = true;
    }

    // Function to set timelock
    function setTimeLockLength(
        uint256 length
    )
    public
    onlyChainportCongress
    {
        freezeLength = length;
    }

    // Function to set minimal value that is considered important by quantity
    function setThreshold(
        uint256 _safetyThreshold
    )
    public
    onlyChainportCongress
    {
        // This is representing % of every asset on the contract
        // Example: 32% is safety threshold
        require(_safetyThreshold > 0 && _safetyThreshold < 100, "Error: % is not valid.");

        safetyThreshold = _safetyThreshold;
    }

    function releaseTokensByMaintainer(
        address token,
        uint256 amount
    )
    public
    onlyMaintainer
    isAmountGreaterThanZero(amount)
    {
        require(fundManager != address(0), "Error: Cold wallet not set.");
        IERC20(token).safeTransfer(fundManager, amount);

        // rebalance event (target, token, amount)
        emit FundsRebalanced(fundManager, token, amount);
    }

    // Function to release tokens
    function releaseTokens(
        bytes memory signature,
        address token,
        uint256 amount,
        uint256 nonce
    )
    public
    isBridgeNotFrozen
    isAmountGreaterThanZero(amount)
    isAssetNotFrozen(token)
    isPathNotPaused(token, "releaseTokens")
    {
        require(isTokenHavingPendingWithdrawal[token] == false, "Error: Token is currently having pending withdrawal.");

        require(isSignatureUsed[signature] == false, "Error: Signature already used");
        isSignatureUsed[signature] = true;

        bytes32 nonceHash = keccak256(abi.encodePacked("releaseTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");


        // msg.sender is beneficiary address
        address beneficiary = msg.sender;
        // Verify the signature user is submitting
        bool isMessageValid = signatureValidator.verifyWithdraw(signature, nonce, beneficiary, amount, token);
        // Requiring that signature is valid
        require(isMessageValid == true, "Error: Signature is not valid.");

        isNonceUsed[nonceHash] = true;
        IERC20(token).safeTransfer(beneficiary, amount);

        emit TokensClaimed(token, beneficiary, amount);
    }

    // Function to check if amount is above threshold
    function isAboveThreshold(address token, uint256 amount) public view returns (bool) {
        return amount >= getTokenBalance(token).mul(safetyThreshold).div(100);
    }

    // Get contract balance of specific token
    function getTokenBalance(address token) internal view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // Function to deposit tokens to bridge on specified network
    function depositTokens(
        address token,
        uint256 amount,
        uint256 networkId
    )
    public
    isBridgeNotFrozen
    isAmountGreaterThanZero(amount)
    isAssetNotFrozen(token)
    isPathNotPaused(token, "depositTokens")
    {
        // Require that network is supported/activated
        require(isNetworkActive[networkId], "Error: Network with this id is not supported.");

        // Get balance before transfer
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));

        // Transfer funds from user to bridge
        IERC20(token).safeTransferFrom(address(msg.sender), address(this), amount);

        // Get balance after transfer
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));

        // Actual amount is exact quantity of tokens received
        uint256 actualAmount = balanceAfter.sub(balanceBefore);

        // Require that actual amount is less or equal to amount
        require(actualAmount <= amount, "Error: Inflationary tokens are not supported.");

        // Emit event
        emit TokensDeposited(token, msg.sender, actualAmount, networkId);
    }

    // Function to activate already added supported network
    function activateNetwork(
        uint256 networkId
    )
    public
    onlyMaintainer
    {
        isNetworkActive[networkId] = true;
        emit NetworkActivated(networkId);
    }

    // Function to deactivate specified added network
    function deactivateNetwork(
        uint256 networkId
    )
    public
    onlyChainportCongress
    {
        isNetworkActive[networkId] = false;
        emit NetworkDeactivated(networkId);
    }

    function setPathPauseState(
        address token,
        string memory functionName,
        bool isPaused
    )
    public
    onlyMaintainer
    {
        isPathPaused[token][functionName] = isPaused;
        emit PathPauseStateChanged(token, functionName, isPaused);
    }

    function setFundManager(
        address newFundManager
    )
    public
    onlyChainportCongress
    {
        // Require that address is not malformed
        require(
            newFundManager != address(0),
            "Error: Cannot set zero address as fundManager address."
        );
        // Set fundManager new address
        fundManager = newFundManager;

        // Emit the event
        emit FundManagerChanged(fundManager);
    }
}
