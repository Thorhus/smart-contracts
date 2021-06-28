//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./ChainportMiddleware.sol";
import "./interfaces/IValidator.sol";

contract ChainportBridgeEth is Initializable, ChainportMiddleware {

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

    // Events
    event TokensUnfreezed(address tokenAddress, address issuer, uint256 amount);
    event TokensFreezed(address tokenAddress, address issuer, uint256 amount);
    event CreatedPendingWithdrawal(address token, address beneficiary, uint256 amount, uint256 unlockingTime);

    event WithdrawalApproved(address token, address beneficiary, uint256 amount);
    event WithdrawalRejected(address token, address beneficiary, uint256 amount);

    event TimeLockLengthChanged(uint256 newTimeLockLength);
    event AssetProtectionChanged(address asset, bool isProtected);
    event SafetyThresholdChanged(uint256 newSafetyThreshold);

    event AssetFrozen(address asset, bool isAssetFrozen);

    modifier isNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    modifier onlyIfAmountGreaterThanZero(uint256 amount) {
        require(amount > 0, "Amount is not greater than zero.");
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
    }

    function unfreezeBridge()
    public
    onlyChainportCongress
    {
        isFrozen = false;
    }

    function freezeAsset(
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
        emit AssetProtectionChanged(tokenAddress, _isProtected);
    }

    function protectAssetByMaintainer(
        address tokenAddress
    )
    public
    onlyMaintainer
    {
        isAssetProtected[tokenAddress] = true;
        emit AssetProtectionChanged(tokenAddress, true);
    }

    // Function to set timelock
    function setTimeLockLength(
        uint256 length
    )
    public
    onlyChainportCongress
    {
        freezeLength = length;
        emit TimeLockLengthChanged(length);
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
        emit SafetyThresholdChanged(_safetyThreshold);
    }

    function freezeToken(
        address token,
        uint256 amount
    )
    public
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        IERC20(token).safeTransferFrom(address(msg.sender), address(this), amount);

        emit TokensFreezed(token, msg.sender, amount);
    }

    function releaseTokensByMaintainer(
        bytes memory signature,
        address token,
        uint256 amount,
        address beneficiary,
        uint256 nonce
    )
    public
    onlyMaintainer
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        require(isTokenHavingPendingWithdrawal[token] == false, "Token is currently having pending withdrawal.");

        require(isSignatureUsed[signature] == false, "Already used signature.");
        isSignatureUsed[signature] = true;

        require(nonce == functionNameToNonce["mintTokens"] + 1, "Invalid nonce");
        functionNameToNonce["mintTokens"] = nonce;

        bool isMessageValid = signatureValidator.verifyWithdraw(signature, token, amount, beneficiary, nonce);
        require(isMessageValid == true, "Error: Signature is not valid.");

        IERC20(token).safeTransfer(beneficiary, amount);

        emit TokensUnfreezed(token, beneficiary, amount);
    }

    function releaseTokensTimelockPassed(
        bytes memory signature,
        address token,
        uint256 amount,
        uint256 nonce
    )
    public
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        require(isSignatureUsed[signature] == false, "Signature already used");
        isSignatureUsed[signature] = true;

        require(nonce == functionNameToNonce["mintTokens"] + 1, "Invalid nonce");
        functionNameToNonce["mintTokens"] = nonce;

        // Check if freeze time has passed and same user is calling again
        if(isTokenHavingPendingWithdrawal[token] == true) {
            PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
            if(p.amount == amount && p.beneficiary == msg.sender && p.unlockingTime <= block.timestamp) {
                // Verify the signature user is submitting
                bool isMessageValid = signatureValidator.verifyWithdraw(signature, token, amount, p.beneficiary, nonce);
                require(isMessageValid == true, "Error: Signature is not valid.");

                // Clear up the state and remove pending flag
                delete tokenToPendingWithdrawal[token];
                isTokenHavingPendingWithdrawal[token] = false;

                IERC20(token).safeTransfer(p.beneficiary, p.amount);

                emit TokensUnfreezed(token, p.beneficiary, p.amount);
                emit WithdrawalApproved(token, p.beneficiary, p.amount);
            }
        } else {
            revert("Invalid function call");
        }
    }

    // Function to release tokens
    function releaseTokens(
        bytes memory signature,
        address token,
        uint256 amount,
        uint256 nonce
    )
    public
    isNotFrozen
    onlyIfAmountGreaterThanZero(amount)
    {
        require(isTokenHavingPendingWithdrawal[token] == false, "Token is currently having pending withdrawal.");

        require(isSignatureUsed[signature] == false, "Signature already used");
        isSignatureUsed[signature] = true;

        require(nonce == functionNameToNonce["mintTokens"] + 1, "Invalid nonce");
        functionNameToNonce["mintTokens"] = nonce;

        // msg.sender is beneficiary address
        address beneficiary = msg.sender;
        // Verify the signature user is submitting
        bool isMessageValid = signatureValidator.verifyWithdraw(signature, token, amount, beneficiary, nonce);
        // Requiring that signature is valid
        require(isMessageValid == true, "Error: Signature is not valid.");


        if(isAboveThreshold(token, amount) && isAssetProtected[token] == true) {

            PendingWithdrawal memory p = PendingWithdrawal({
                amount: amount,
                beneficiary: beneficiary,
                unlockingTime: now.add(freezeLength)
            });

            tokenToPendingWithdrawal[token] = p;
            isTokenHavingPendingWithdrawal[token] = true;

            // Fire an event
            emit CreatedPendingWithdrawal(token, beneficiary, amount, p.unlockingTime);
        } else {
            IERC20(token).safeTransfer(beneficiary, amount);

            emit TokensUnfreezed(token, beneficiary, amount);
        }
    }

    // Function for congress to approve withdrawal and transfer funds
    function approveWithdrawalAndTransferFunds(
        address token
    )
    public
    onlyChainportCongress
    isNotFrozen
    {
        require(isTokenHavingPendingWithdrawal[token] == true);
        // Get current pending withdrawal attempt
        PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
        // Clear up the state and remove pending flag
        delete tokenToPendingWithdrawal[token];
        isTokenHavingPendingWithdrawal[token] = false;

        // Transfer funds to user
        IERC20(token).safeTransfer(p.beneficiary, p.amount);

        // Emit events
        emit TokensUnfreezed(token, p.beneficiary, p.amount);
        emit WithdrawalApproved(token, p.beneficiary, p.amount);
    }

    // Function to reject withdrawal from congress
    function rejectWithdrawal(
        address token
    )
    public
    onlyChainportCongress
    isNotFrozen
    {
        require(isTokenHavingPendingWithdrawal[token] == true);
        // Get current pending withdrawal attempt
        PendingWithdrawal memory p = tokenToPendingWithdrawal[token];
        emit WithdrawalRejected(token, p.beneficiary, p.amount);
        // Clear up the state and remove pending flag
        delete tokenToPendingWithdrawal[token];
        isTokenHavingPendingWithdrawal[token] = false;
    }

    // Function to check if amount is above threshold
    function isAboveThreshold(address token, uint256 amount) public view returns (bool) {
        return amount >= getTokenBalance(token).mul(safetyThreshold).div(100);
    }

    // Get contract balance of specific token
    function getTokenBalance(address token) internal view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
