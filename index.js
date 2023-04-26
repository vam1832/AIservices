const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();
require("fetch");

const { PineconeClient } = require("@pinecone-database/pinecone");
const openai = require("openai");

const app = express();
// configurar Cors
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// configurar middleware bodyparser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// set apikey OpenAI
openai.apiKey = process.env.OPENAI_API_KEY;

app.post("/get-restaurant", async (req, res) => {
  const { search } = req.body;

  // Convertir texto a embbeding
  async function getEmbedding(search) {
    const url = "https://api.openai.com/v1/embeddings";
    const model = "text-embedding-ada-002";
    const body = { input: search, model: model };
    const headers = {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    };
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: headers,
    });
    const data = await response.json();
    console.log(data)
    return data.data[0].embedding;
  }

  // Hacer llamada a Pinecone
  async function searchVectorData(embedding) {
    const endpoint = process.env.PINECONE_URI_DATABASE;
    const apiKey = process.env.PINECONE_API_KEY;

    const response = await fetch(`${endpoint}`, {
      method: "POST",
      headers: {
        "Api-Key": `${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vector: embedding,
        top_k: 4,
        namespace: "my-data",
        includeValues: true,
        includeMetadata: true,
      }),
    });
    const data = await response.json();
    return data;
  }

  // Hacer llamada a completions
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiUrl = "https://api.openai.com/v1/completions";

  async function getChatResponse(search, contenido, plato) {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = "gpt-3.5-turbo";
    const url = "https://api.openai.com/v1/chat/completions";

  
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `
            Eres una IA FAQ, a partir de ahora vas a limitarte a contestar preguntas sobre este contenido: ${contenido}. 
            NO DES MÁS INFORMACIÓN Y NO SUPONAGAS NADA. No contestes con Respuesta: o según el contenido.
            Recuerda que el plato recomendato es ${plato}. No sabes si venden ahi o no el plato pero puedes indicar que la categoria es la misma y puede
            consumir un plato parecido o enaltecer la categoria del plato.
            responde como si estuviera recomendando, y recuerda escoger solo un restaurante siempre y recomendarlo de una forma muy natural.
            el usuario te proporcionará sus gustos y preferencias tienes que categorizarlas. Recueda considerar comidas fusion en caso el usuario
            quiera experimentar.
            Como FAQ debes dar repuestas cortas y precisas y dar la respuesta en en lenguaje sencillo y cercano minimo de 5 lineas.
            Cuando no sepas la respuesta o tengas dudas contesta con la siguiente frase "Lo siento, pero no lo sé".
            `
          },
          {
            role: 'user',
            content: `recomiendame un restaurante segun mis preferencias:${search}`
          }
        ]
      })
    });
  
    const json = await response.json();
    // console.log(json.choices[0].message.content)
    return json.choices[0].message.content;
  }

  const embbedingText = await getEmbedding(search);
  const searchEmbeddingsRes = await searchVectorData(embbedingText);
  content = searchEmbeddingsRes.matches.map((restaurant) => restaurant.metadata)
  console.log(content)

  // Extraer el contenido del resultado de Pinecone
  const contenido = searchEmbeddingsRes.matches
    .map((match) => match.metadata.content)
    .join(". ");

  // Hacer llamada a OpenAI
  const results = await getChatResponse(search, contenido)
  console.log(results)
  res.json({ message: results});
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});