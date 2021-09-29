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
    // Whitelisted addresses for releasing funds
    mapping(address => bool) public isWhitelisted;
    // Mapping for getting maximal nonce per function
    mapping(string => uint256) public functionNameToMaxNonce;

    // Events
    event TokensClaimed(address tokenAddress, address issuer, uint256 amount);
    event AssetFrozen(address asset, bool state);
    event NetworkActivated(uint256 networkId);
    event NetworkDeactivated(uint256 networkId);
    event TokensDeposited(address tokenAddress, address issuer, uint256 amount, uint256 networkId);
    event PathPauseStateChanged(address tokenAddress, string functionName, bool state);
    event BridgeFrozen(bool state);
    event FundManagerChanged(address newFundManager);
    event AddressWhitelisted(address whitelistedAddress, bool state);
    event FundsRebalancedFromHotBridge(address target, address token, uint256 amount);

    // Modifiers
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

    function initialize(
        address _maintainersRegistryAddress,
        address _chainportCongress,
        address _signatureValidator
    )
    public
    initializer
    {
        setCongressAndMaintainers(_chainportCongress, _maintainersRegistryAddress);
        signatureValidator = IValidator(_signatureValidator);
    }

    // Function to freeze the bridge
    function freezeBridge()
    external
    onlyMaintainer
    {
        isFrozen = true;
        emit BridgeFrozen(true);
    }

    // Function to unfreeze the bridge
    // TODO: Check if it is better to set state instead of only unfreezing
    function unfreezeBridge()
    external
    onlyChainportCongress
    {
        isFrozen = false;
        emit BridgeFrozen(false);
    }

    // Function to set asset freeze state by congress
    function setAssetFreezeState(
        address tokenAddress,
        bool _isFrozen
    )
    external
    onlyChainportCongress
    {
        isAssetFrozen[tokenAddress] = _isFrozen;
        emit AssetFrozen(tokenAddress, _isFrozen);
    }

    // Function to freeze asset by maintainer
    function freezeAssetByMaintainer(
        address tokenAddress
    )
    external
    onlyMaintainer
    {
        isAssetFrozen[tokenAddress] = true;
        emit AssetFrozen(tokenAddress, true);
    }

    // Function to transfer funds to fundManager contract
    function releaseTokensByMaintainer(
        address token,
        address safeBeneficiary,
        uint256 amount,
        uint256 nonce
    )
    public
    onlyMaintainer
    isAmountGreaterThanZero(amount)
    {
        // Require that the beneficiary is whitelisted
        require(
            isWhitelisted[safeBeneficiary] || safeBeneficiary == fundManager,
            "Error: Beneficiary is not a safe address."
        );

        // Set new nonce as the maximal nonce for selected function
        functionNameToMaxNonce["releaseTokensByMaintainer"] = nonce;

        // Generate nonceHash and check if nonce has been used before or not
        bytes32 nonceHash = keccak256(abi.encodePacked("releaseTokensByMaintainer", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");

        // Specify that the nonce has been used now
        isNonceUsed[nonceHash] = true;

        // Transfer funds to beneficiary safe address
        IERC20(token).safeTransfer(safeBeneficiary, amount);

        emit FundsRebalancedFromHotBridge(safeBeneficiary, token, amount);
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
        // Require that signature was not used already
        require(isSignatureUsed[signature] == false, "Error: Signature already used");
        isSignatureUsed[signature] = true;

        // Check nonce
        bytes32 nonceHash = keccak256(abi.encodePacked("releaseTokens", nonce));
        require(!isNonceUsed[nonceHash], "Error: Nonce already used.");
        isNonceUsed[nonceHash] = true;

        // msg.sender is beneficiary address
        address beneficiary = msg.sender;
        // Verify the signature user is submitting
        bool isMessageValid = signatureValidator.verifyWithdraw(signature, nonce, beneficiary, amount, token);
        // Requiring that signature is valid
        require(isMessageValid == true, "Error: Signature is not valid.");

        // Perform the transfer
        IERC20(token).safeTransfer(beneficiary, amount);

        emit TokensClaimed(token, beneficiary, amount);
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
    external
    onlyMaintainer
    {
        isNetworkActive[networkId] = true;
        emit NetworkActivated(networkId);
    }

    // Function to deactivate specified added network
    function deactivateNetwork(
        uint256 networkId
    )
    external
    onlyChainportCongress
    {
        isNetworkActive[networkId] = false;
        emit NetworkDeactivated(networkId);
    }

    // Function to pause/unpause specific path/flow
    function setPathPauseState(
        address token,
        string memory functionName,
        bool isPaused
    )
    external
    onlyMaintainer
    {
        isPathPaused[token][functionName] = isPaused;
        emit PathPauseStateChanged(token, functionName, isPaused);
    }

    // Function to set fundManager contract address
    function setFundManager(
        address _fundManager
    )
    external
    onlyChainportCongress
    {
        // Require that address is not malformed
        require(
            _fundManager != address(0),
            "Error: Cannot set zero address as fundManager address."
        );

        // Set fundManager new address
        fundManager = _fundManager;
        // Emit the event
        emit FundManagerChanged(fundManager);
    }

    // Function to whitelist/blacklist addresses
    function setAddressesWhitelistState(
        address [] calldata addresses,
        bool state
    )
    external
    onlyChainportCongress
    {
        for(uint8 i; i < addresses.length; i++) {
            require(addresses[i] != address(0));
            isWhitelisted[addresses[i]] = state;
            emit AddressWhitelisted(addresses[i], state);
        }
    }
}
