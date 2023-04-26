import chai = require("chai");
import chaiHttp = require("chai-http");
// TODO: Choose which function can be tested

let should = chai.should();
chai.use(chaiHttp)

describe("Health Check", function () {
  describe("#mainServerHealth()", function () {
    it("should return a status code of 200", function (done) {
      // hit api
      let api: string = 'https://api.effie.boo'
      chai.request(api).get('/api').end(function (_, res) {
        res.should.have.status(200);
        done();
      })
    });
  });
  describe("#devServerHealth()", function () {
    it("should return a status code of 200", function (done) {
      // hit api
      let api: string = 'https://dev.api.effie.boo'
      chai.request(api).get('/api').end(function (_, res) {
        res.should.have.status(200);
        done();
      })
    });
  });
});
