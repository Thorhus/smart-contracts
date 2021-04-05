const { expect } = require("chai");

describe("BridgeEth", function() {
  it("Should return the new greeting once it's changed", async function() {
    const BridgeEth = await ethers.getContractFactory("BridgeEth");
    const bridge = await BridgeEth.deploy("0x6c6ee5e31d828de241282b9606c8e98ea48526e2");

    await bridge.deployed();
    // expect(await bridge.greet()).to.equal("Hello, world!");

    console.log("Bridge deployed to:", bridge.address);

    await bridge.admin().then((res)=>{
      console.log("Bridge admin");
      console.log(res);
    });
    await bridge.token().then((res)=>{
      console.log("Bridge token");
      console.log(res);
    });
    await bridge.nonce().then((res)=>{
      console.log("Bridge nonce");
      console.log(res);
    });


    console.log("Bridge token");
    console.log("Bridge nonce", bridge.nonce());

  });
});
