const handler = async (
  _event: AWSLambda.APIGatewayEvent
): Promise<any> => {
  const body = {}
  return {
    statusCode: 200,
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  };
};

export default handler
