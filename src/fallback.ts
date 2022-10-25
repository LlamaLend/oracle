const handler = async (
  _event: AWSLambda.APIGatewayEvent
): Promise<any> => {
  const response = {
    statusCode: 404,
    body: "This endpoint doesn't exist",
    headers: {
        "Cache-Control": `max-age=${3600}`,
        "Access-Control-Allow-Origin": "*",
    }
  }

  return response;
};

export default handler;
