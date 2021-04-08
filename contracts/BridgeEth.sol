pragma solidity ^0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "@openzeppelin/contracts/proxy/Initializable.sol";
import "@openzeppelin/contracts/access/Roles.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

import './BridgeEthVault.sol';

//Check what do to with more decimals

contract BridgeEth is Ownable{
    using Roles for Roles.Role;

    Roles.roles private _maintainers;
    Roles.roles private _congress;

    address public admin;
    address public vault;

    mapping(address => uint) public balancesByAddresses;

    event ReleaseTokens(address ercToken, address sendTo, uint amount);
    event FreezeTokens(address ercToken, address sendTo, uint amount);
    event AdminChanged(address newAdmin);


    constructor(){
        
    }

    function setAdmin(address newAdmin) onlyChainportCongress {
        require(!newAdmin);
        admin = newAdmin;
        emit AdminChanged(newAdmin);
    }

    function setVault(address newVault) onlyChainportCongress {
        require(!vault);
        vault = newVault;
    }

    function freezeToken(address token) public payable{
        IERC20 ercToken = IToken(token);
        uint tokenSent = ercToken.balanceOf(address(this));

        ercToken.transfer(address(vault), tokenSent);

        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)] + tokenSent;

        emit FreezeTokens(token, msg.sender, tokenSent);
    }

    function releaseTokens(address token, address receiver, uint amount) public {
        require(_maintainers.has(msg.sender), "DOES_NOT_HAVE_MAINTAINER_ROLE");
        require(balancesByAddresses[address(token)] >= amount);

        address _vault = BridgeEthVault(vault);
        _vault.transferTokens(token, receiver, amount);
        balancesByAddresses[address(token)] = balancesByAddresses[address(token)] - amount;

        emit ReleaseTokens(token, msg.sender, tokenSent);
    }
}
