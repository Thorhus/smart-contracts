//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "./BridgeMintableToken.sol";
import "./ChainportUpgradables.sol";
import "./interfaces/IValidator.sol";


contract ChainportBridgeBsc is ChainportUpgradables {

    IValidator public signatureValidator;

    mapping(address => address) public erc20ToBep20Address;
    mapping(string => uint256) public functionNameToNonce;
    mapping(address => bool) public isCreatedByTheBridge;

    // Mapping if bridge is Frozen
    bool public isFrozen;

    event TokensMinted(address tokenAddress, address issuer, uint amount);
    event TokensBurned(address tokenAddress, address issuer, uint amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol, uint8 decimals);

    modifier isNotFrozen {
        require(isFrozen == false, "Error: All Bridge actions are currently frozen.");
        _;
    }

    // Set initial addresses
    function initialize(
        address _chainportCongress,
        address _maintainersRegistry
    )
    public
    initializer
    {
        setCongressAndMaintainers(_chainportCongress, _maintainersRegistry);
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

    function mintNewToken(
        address erc20_address,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals
    )
    public
    onlyMaintainer
    isNotFrozen
    {
        require(erc20ToBep20Address[address(erc20_address)] == address(0), "MintNewToken: Token already exists.");

        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol, decimals);

        erc20ToBep20Address[address(erc20_address)] = address(newToken);
        isCreatedByTheBridge[address(newToken)] = true;
        TokenCreated(address(newToken), erc20_address, tokenName, tokenSymbol, decimals);
    }

    function mintTokens(
        address token,
        address receiver,
        uint256 amount,
        uint256 nonce
    )
    public
    onlyMaintainer
    isNotFrozen
    {
        require(nonce == functionNameToNonce["mintTokens"] + 1, "Nonce is not correct");
        functionNameToNonce["mintTokens"] = nonce;

        BridgeMintableToken ercToken = BridgeMintableToken(token);
        ercToken.mint(receiver, amount);
        emit TokensMinted(token, msg.sender, amount);
    }


    function burnTokens(address bep20Token, uint256 amount) public {
        require(amount > 0, "Amount is not greater than zero.");
        require(isCreatedByTheBridge[bep20Token], "BurnTokens: Token is not created by the bridge.");

        BridgeMintableToken ercToken = BridgeMintableToken(bep20Token);
        ercToken.burnFrom(address(msg.sender), amount);
        TokensBurned(address(ercToken), msg.sender, amount);
    }
}
