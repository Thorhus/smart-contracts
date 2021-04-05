pragma solidity ^0.6.12;

interface IToken {
    function mint(address to, uint amount) external;
    function burn(address owner, uint amount) external;
}
