const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// Tus variables de entorno (las configuraremos en Vercel)
const KOMMO_API_TOKEN = process.env.KOMMO_API_TOKEN;
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const KOMMO_SUBDOMAIN = process.env.KOMMO_SUBDOMAIN;

// Endpoint que Kommo llamará
app.post('/', async (req, res) => {
    try {
        // Obtenemos el ID del lead del evento de cambio de etapa
        const lead = req.body.leads.status[0] || req.body.leads.add[0];
        if (!lead || !lead.id) {
            console.log("No lead ID found in request.");
            return res.status(200).send("OK - No action needed");
        }
        const leadId = lead.id;
        console.log(`Processing event for Lead ID: ${leadId}`);

        // 1. Investigar: Llamar a la API de Kommo para obtener las conversaciones
        const kommoApiUrl = `https://${KOMMO_SUBDOMAIN}.kommo.com/api/v4/leads/${leadId}/talks`;
        const apiResponse = await axios.get(kommoApiUrl, {
            headers: {
                'Authorization': `Bearer ${KOMMO_API_TOKEN}`
            }
        });

        const talks = apiResponse.data?._embedded?.talks;
        if (!talks || talks.length === 0) {
            console.log(`No talks found for Lead ID: ${leadId}`);
            return res.status(200).send("OK - No talks found");
        }

        // 2. Encontrar el talk_id más reciente (el primero, ya que la API los devuelve ordenados)
        const lastTalkId = talks[0].id;
        console.log(`Found most recent talk_id: ${lastTalkId}`);

        // 3. Actuar: Llamar al Webhook de Make con la información procesada
        await axios.post(MAKE_WEBHOOK_URL, {
            lead_id: leadId,
            talk_id: lastTalkId
        });
        
        console.log(`Successfully triggered Make webhook for talk_id: ${lastTalkId}`);
        
        // Responder a Kommo que todo está bien
        res.status(200).send('OK');

    } catch (error) {
        console.error("An error occurred:", error.response ? error.response.data : error.message);
        res.status(200).send('OK - Error processing'); // Siempre respondemos 200 a Kommo para que no reintente.
    }
});

// Exportar la app para Vercel
module.exports = app;
