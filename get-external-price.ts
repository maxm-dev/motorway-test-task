export async function getExternalPrice(numberPlate: string): Promise<number> {
  console.log('Call 3rd party API for: ', numberPlate);

  const price = Math.round(Math.random() * 100);
  return new Promise<number>((resolve) => {
    setTimeout(() => resolve(price), 1000);
  });
}