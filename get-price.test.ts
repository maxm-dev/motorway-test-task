import {getPrice} from "./get-price";
import {getExternalPrice} from "./get-external-price";
import {client} from "./init-redis";

jest.mock("./get-external-price");
jest.mock("./init-redis");

describe("Get price", () => {
  beforeEach(() => {
    (client.sIsMember as jest.Mock).mockReturnValue(false);
  })

  it("should return price and cache it", async () => {
    const numberPlate = "test1";
    const expectedPrice = 11;
    (getExternalPrice as jest.Mock).mockReturnValueOnce(expectedPrice);

    const price = await getPrice("test1", false);

    expect(price).toEqual(expectedPrice);
    expect(getExternalPrice).toHaveBeenCalledTimes(1);
    expect(getExternalPrice).toHaveBeenCalledWith(numberPlate);
    expect(client.hSet).toHaveBeenCalledTimes(1);
    expect(client.hSet).toHaveBeenCalledWith(expect.any(String), numberPlate, expectedPrice);
    expect(client.publish).toHaveBeenCalledTimes(1);
    expect(client.publish).toHaveBeenCalledWith(numberPlate, expectedPrice.toString());
  });

  it("should return result from cache", async () => {
    const expectedPrice = 11;
    (client.hGet as jest.Mock).mockReturnValueOnce(expectedPrice.toString());

    const price = await getPrice("test1", false);

    expect(price).toEqual(expectedPrice);
    expect(getExternalPrice).not.toHaveBeenCalled();
    expect(client.hSet).not.toHaveBeenCalled();
    expect(client.publish).not.toHaveBeenCalled();
  });

  it("should handle two parallel requests", (done) => {
    const expectedPrice = 11;
    const numberPlate = "test1";
    (getExternalPrice as jest.Mock).mockReturnValueOnce(expectedPrice);
    (client.duplicate as jest.Mock).mockImplementationOnce(function duplicateMock(this: any) {return this;})

    const request1 = getPrice("test1", false);

    setTimeout(async () => {
      (client.sIsMember as jest.Mock).mockReturnValueOnce(true);
      (client.subscribe as jest.Mock).mockImplementationOnce((_, listener) => {listener(expectedPrice)});

      const request2 = getPrice("test1", false);

      const price1 = await request1;
      const price2 = await request2;

      expect(client.publish).toHaveBeenCalledWith(numberPlate, expectedPrice.toString());
      expect(getExternalPrice).toHaveBeenCalledTimes(1);
      expect(getExternalPrice).toHaveBeenCalledWith(numberPlate);
      expect(client.publish).toHaveBeenCalledWith(numberPlate, expectedPrice.toString());
      expect(price1).toEqual(expectedPrice);
      expect(price2).toEqual(expectedPrice);
      done();
    })
  });

  it("handle two parallel requests for different number plates", async () => {
    const expectedPrice1 = 11;
    const expectedPrice2 = 12;
    (getExternalPrice as jest.Mock).mockReturnValueOnce(expectedPrice1);

    const price1 = await getPrice("test1", false);

    (getExternalPrice as jest.Mock).mockReturnValueOnce(expectedPrice2);
    const price2 = await getPrice("test2", false);


    expect(price1).toEqual(expectedPrice1);
    expect(price2).toEqual(expectedPrice2);
    expect(getExternalPrice).toHaveBeenCalledTimes(2);
  });
})