pragma solidity ^0.6.12;

//import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
//import "@openzeppelin/contracts/proxy/Initializable.sol";
//import "@openzeppelin/contracts/access/Roles.sol";
//import "@openzeppelin/contracts/ownership/Ownable.sol";

//import './BridgeEthVault.sol';
//import './IToken.sol';


//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.0/master/contracts/token/ERC20/ERC20.sol";
//import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.4.0/master/contracts/token/ERC20/ERC20Burnable.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";

contract BridgeMintableToken is ERC20, ERC20Burnable{

    constructor(string memory tokenName_, string memory tokenSymbol_) public ERC20(tokenName_, tokenSymbol_) {}

    event Mint(address indexed to, uint256 amount);

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
        Mint(_to, _amount);
    }
}


contract ChainportBridgeBsc{
    //contract BridgeEth is Ownable{
//    using Roles for Roles.Role;

//    Roles.roles private _maintainers;
//    Roles.roles private _congress;

//    address public admin;
//    address public vault;

    mapping(address => uint) public balancesByAddresses;
    mapping(address => address) public bep20ByErc20Address;

    event TokensMinted(address tokenAddress, address issuer, uint amount);
    event TokensBurned(address tokenAddress, address issuer, uint amount);
    event TokenCreated(address newTokenAddress, address ethTokenAddress, string tokenName, string tokenSymbol);


    function mintNewToken(address erc20_address, string memory tokenName, string memory tokenSymbol) public {
        BridgeMintableToken newToken = new BridgeMintableToken(tokenName, tokenSymbol);

        bep20ByErc20Address[address(erc20_address)] = address(newToken);
        TokenCreated(address(newToken), erc20_address, tokenName, tokenSymbol);
    }

    function mintTokens(address token, address receiver, uint256 amount) public payable{
        BridgeMintableToken ercToken = BridgeMintableToken(token);


        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)] + amount;
        ercToken.mint(receiver, amount);

        emit TokensMinted(token, msg.sender, amount);
    }

    function burnTokens(address bep20Token, uint256 amount) public payable{
        BridgeMintableToken ercToken = BridgeMintableToken(bep20Token);

        ercToken.burnFrom(address(msg.sender), amount);

        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)]- amount;

        TokensBurned(address(ercToken), msg.sender, amount);
    }
}
