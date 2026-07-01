const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CoresID", function () {
  let coresid, owner, core, seed1, seed2, seed3, seed4, seed5, seed6;
  const BASE_URI = "https://example.com/metadata/";
  const MAX_SEEDS = 5n;

  beforeEach(async function () {
    [owner, core, seed1, seed2, seed3, seed4, seed5, seed6] =
      await ethers.getSigners();

    const CoresID = await ethers.getContractFactory("CoresID");
    coresid = await CoresID.connect(owner).deploy(BASE_URI, owner.address);
  });

  describe("Deployment", function () {
    it("should set name, symbol, baseURI, and owner", async function () {
      expect(await coresid.name()).to.equal("CoresID");
      expect(await coresid.symbol()).to.equal("CRID");
      expect(await coresid.baseURI()).to.equal(BASE_URI);
      expect(await coresid.owner()).to.equal(owner.address);
    });

    it("should start with zero supply", async function () {
      expect(await coresid.totalSupply()).to.equal(0n);
    });

    it("should have MAX_SEEDS = 5", async function () {
      expect(await coresid.MAX_SEEDS()).to.equal(MAX_SEEDS);
    });
  });

  describe("Nominate", function () {
    it("should nominate 1 seed", async function () {
      await expect(coresid.connect(core).nominate([seed1.address]))
        .to.emit(coresid, "Nominated")
        .withArgs(core.address, seed1.address);

      expect(await coresid.isNominated(core.address, seed1.address)).to.be.true;
      expect(await coresid.pendingCount(core.address)).to.equal(1n);
      expect(await coresid.seedCount(core.address)).to.equal(0n);
    });

    it("should nominate 5 seeds in one tx", async function () {
      const seeds = [seed1, seed2, seed3, seed4, seed5].map((s) => s.address);
      await expect(coresid.connect(core).nominate(seeds))
        .to.emit(coresid, "Nominated")
        .withArgs(core.address, seed1.address)
        .to.emit(coresid, "Nominated")
        .withArgs(core.address, seed5.address);

      expect(await coresid.pendingCount(core.address)).to.equal(5n);
    });

    it("should reject empty seeds array", async function () {
      await expect(
        coresid.connect(core).nominate([])
      ).to.be.revertedWithCustomError(coresid, "ZeroAddress");
    });

    it("should reject zero address seed", async function () {
      await expect(
        coresid.connect(core).nominate([ethers.ZeroAddress])
      ).to.be.revertedWithCustomError(coresid, "ZeroAddress");
    });

    it("should reject nominating same seed twice", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await expect(
        coresid.connect(core).nominate([seed1.address])
      ).to.be.revertedWithCustomError(coresid, "SeedAlreadyNominated");
    });

    it("should reject nominating more than 5 total (pending + minted)", async function () {
      const seeds = [seed1, seed2, seed3, seed4, seed5, seed6].map((s) => s.address);
      await expect(
        coresid.connect(core).nominate(seeds)
      ).to.be.revertedWithCustomError(coresid, "MaxSeedsExceeded");
    });

    it("should reject nominate when already at max pending", async function () {
      const seeds = [seed1, seed2, seed3, seed4, seed5].map((s) => s.address);
      await coresid.connect(core).nominate(seeds);
      await expect(
        coresid.connect(core).nominate([seed6.address])
      ).to.be.revertedWithCustomError(coresid, "MaxSeedsExceeded");
    });

    it("should reject nominating a seed already linked to another core", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);

      await expect(
        coresid.connect(core).nominate([seed1.address])
      ).to.be.revertedWithCustomError(coresid, "SeedAlreadyLinked");
    });

    it("should nominate seed that was previously cancelled", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(core).cancelNomination(seed1.address);
      await expect(coresid.connect(core).nominate([seed1.address]))
        .to.emit(coresid, "Nominated")
        .withArgs(core.address, seed1.address);
    });
  });

  describe("CancelNomination", function () {
    it("should cancel a pending nomination", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await expect(coresid.connect(core).cancelNomination(seed1.address))
        .to.emit(coresid, "NominationCancelled")
        .withArgs(core.address, seed1.address);

      expect(await coresid.isNominated(core.address, seed1.address)).to.be.false;
      expect(await coresid.pendingCount(core.address)).to.equal(0n);
    });

    it("should free a slot for new nominations after cancel", async function () {
      const seeds = [seed1, seed2, seed3, seed4, seed5].map((s) => s.address);
      await coresid.connect(core).nominate(seeds);
      await coresid.connect(core).cancelNomination(seed5.address);
      await expect(coresid.connect(core).nominate([seed6.address]))
        .to.emit(coresid, "Nominated")
        .withArgs(core.address, seed6.address);
    });

    it("should revert cancel on non-existent nomination", async function () {
      await expect(
        coresid.connect(core).cancelNomination(seed1.address)
      ).to.be.revertedWithCustomError(coresid, "NoPendingNomination");
    });

    it("should revert cancel after seed has minted (nomination is cleared)", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);
      await expect(
        coresid.connect(core).cancelNomination(seed1.address)
      ).to.be.revertedWithCustomError(coresid, "NoPendingNomination");
    });
  });

  describe("Mint", function () {
    it("should mint NFT to core on first seed claim", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      const tx = await coresid.connect(seed1).mint(core.address);

      await expect(tx)
        .to.emit(coresid, "Minted")
        .withArgs(core.address, seed1.address, 1n);

      expect(await coresid.ownerOf(0n)).to.equal(core.address);
      expect(await coresid.seedCount(core.address)).to.equal(1n);
      expect(await coresid.pendingCount(core.address)).to.equal(0n);
      expect(await coresid.coreOfSeed(seed1.address)).to.equal(core.address);
      expect(await coresid.coreTokenId(core.address)).to.equal(0n);
      expect(await coresid.tokenCore(0n)).to.equal(core.address);
    });

    it("should level up (not mint new) on 2nd seed claim", async function () {
      await coresid.connect(core).nominate([seed1.address, seed2.address]);
      await coresid.connect(seed1).mint(core.address);
      const tx = await coresid.connect(seed2).mint(core.address);

      await expect(tx)
        .to.emit(coresid, "Minted")
        .withArgs(core.address, seed2.address, 2n);

      // Still only 1 token
      expect(await coresid.totalSupply()).to.equal(1n);
      expect(await coresid.ownerOf(0n)).to.equal(core.address);
      expect(await coresid.seedCount(core.address)).to.equal(2n);
    });

    it("should level up to 5 with 5 seeds", async function () {
      const seeds = [seed1, seed2, seed3, seed4, seed5];
      await coresid.connect(core).nominate(seeds.map((s) => s.address));

      for (let i = 0; i < 5; i++) {
        const tx = await coresid.connect(seeds[i]).mint(core.address);
        await expect(tx)
          .to.emit(coresid, "Minted")
          .withArgs(core.address, seeds[i].address, BigInt(i + 1));
      }

      expect(await coresid.seedCount(core.address)).to.equal(5n);
      expect(await coresid.totalSupply()).to.equal(1n);
    });

    it("should reject nominate after core already has 5 seeds minted", async function () {
      const seeds = [seed1, seed2, seed3, seed4, seed5];
      await coresid.connect(core).nominate(seeds.map((s) => s.address));
      for (const s of seeds) {
        await coresid.connect(s).mint(core.address);
      }

      await expect(
        coresid.connect(core).nominate([seed6.address])
      ).to.be.revertedWithCustomError(coresid, "MaxSeedsExceeded");
    });

    it("should reject mint by non-nominated seed", async function () {
      await expect(
        coresid.connect(seed1).mint(core.address)
      ).to.be.revertedWithCustomError(coresid, "NotNominated");
    });

    it("should reject nominating a seed that is already linked to another core", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);

      const core2 = seed2; // reuse another signer as a second core
      await expect(
        coresid.connect(core2).nominate([seed1.address])
      ).to.be.revertedWithCustomError(coresid, "SeedAlreadyLinked");
    });

    it("should reject mint when nominated for a different core", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await expect(
        coresid.connect(seed1).mint(owner.address) // wrong core
      ).to.be.revertedWithCustomError(coresid, "NotNominated");
    });
  });

  describe("Soulbound", function () {
    it("should revert transfer", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);
      await expect(
        coresid.connect(core).transferFrom(core.address, seed2.address, 0n)
      ).to.be.revertedWithCustomError(coresid, "TokenIsSoulbound");
    });

    it("should revert approve", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);
      await expect(
        coresid.connect(core).approve(seed2.address, 0n)
      ).to.be.revertedWithCustomError(coresid, "TokenIsSoulbound");
    });

    it("should revert setApprovalForAll", async function () {
      await expect(
        coresid.connect(core).setApprovalForAll(seed1.address, true)
      ).to.be.revertedWithCustomError(coresid, "TokenIsSoulbound");
    });

    it("should revert safeTransferFrom", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);
      await expect(
        coresid.connect(core)["safeTransferFrom(address,address,uint256)"](
          core.address, seed2.address, 0n
        )
      ).to.be.revertedWithCustomError(coresid, "TokenIsSoulbound");
    });

    it("should report locked via IERC5192 interface", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);
      expect(await coresid.locked(0n)).to.be.true;
    });

    it("should be Locked event on mint", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await expect(coresid.connect(seed1).mint(core.address))
        .to.emit(coresid, "Locked")
        .withArgs(0n);
    });
  });

  describe("TokenURI", function () {
    it("should return level 1 metadata URI after first mint", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);
      expect(await coresid.tokenURI(0n)).to.equal(BASE_URI + "1.json");
    });

    it("should return level 2 metadata URI after second mint", async function () {
      await coresid.connect(core).nominate([seed1.address, seed2.address]);
      await coresid.connect(seed1).mint(core.address);
      await coresid.connect(seed2).mint(core.address);
      expect(await coresid.tokenURI(0n)).to.equal(BASE_URI + "2.json");
    });

    it("should return level 5 metadata URI at max", async function () {
      const seeds = [seed1, seed2, seed3, seed4, seed5];
      await coresid.connect(core).nominate(seeds.map((s) => s.address));
      for (const s of seeds) {
        await coresid.connect(s).mint(core.address);
      }
      expect(await coresid.tokenURI(0n)).to.equal(BASE_URI + "5.json");
    });

    it("should revert tokenURI for non-existent token", async function () {
      await expect(coresid.tokenURI(999n))
        .to.be.revertedWithCustomError(coresid, "ERC721NonexistentToken");
    });

    it("should update after setBaseURI", async function () {
      await coresid.connect(core).nominate([seed1.address]);
      await coresid.connect(seed1).mint(core.address);
      await coresid.connect(owner).setBaseURI("ipfs://QmNew/");
      expect(await coresid.tokenURI(0n)).to.equal("ipfs://QmNew/1.json");
    });
  });

  describe("Owner", function () {
    it("should set baseURI via owner", async function () {
      await coresid.connect(owner).setBaseURI("ipfs://QmNew/");
      expect(await coresid.baseURI()).to.equal("ipfs://QmNew/");
    });

    it("should reject setBaseURI from non-owner", async function () {
      await expect(
        coresid.connect(core).setBaseURI("ipfs://QmNew/")
      ).to.be.revertedWithCustomError(coresid, "OwnableUnauthorizedAccount");
    });
  });

  describe("SupportsInterface", function () {
    it("should support ERC721", async function () {
      expect(await coresid.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("should support IERC5192", async function () {
      expect(await coresid.supportsInterface("0xb45a3c0e")).to.be.true;
    });

    it("should not support random interface", async function () {
      expect(await coresid.supportsInterface("0x12345678")).to.be.false;
    });
  });
});
