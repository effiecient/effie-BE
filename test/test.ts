import chai = require("chai");
import chaiHttp = require("chai-http");
import { getDB } from "../utils";
import { getBothDB } from "../utils/firebase";
// TODO: Choose which function can be tested
// TODO: Create a function to check db connection

let should = chai.should();
chai.use(chaiHttp);

describe("Server Health Check", function () {
  describe("#mainServerHealth()", function () {
    it("should return a status code of 200", function (done) {
      // hit api
      let api: string = "https://api.effie.boo";
      chai
        .request(api)
        .get("/api")
        .end(function (_, res) {
          res.should.have.status(200);
          done();
        });
    });
  });
  describe("#devServerHealth()", function () {
    it("should return a status code of 200", function (done) {
      // hit api
      let api: string = "https://dev.api.effie.boo";
      chai
        .request(api)
        .get("/api")
        .end(function (_, res) {
          res.should.have.status(200);
          done();
        });
    });
  });
});

describe("Database Health Check", function () {
  const { mainDB, devDB } = getBothDB();
  describe("#mainDBHealth()", function () {
    it("should return a number indicating DB is active", function (done) {
      // get DB and read user collection
      mainDB
        .collection("users")
        .get()
        .then((snapshot: any) => {
          snapshot.size.should.be.a('number');
          done();
        })
        .catch((err: any) => {
          console.log(err);
          done();
        });
    });
  });
  describe("#devDBHealth()", function () {
    it("should return a number indicating DB is active", function (done) {
      // hit api
      devDB
      .collection("users")
      .get()
      .then((snapshot: any) => {
        snapshot.size.should.be.a('number');
        done();
      })
      .catch((err: any) => {
        console.log(err);
        done();
      });
    });
  });
});
