// register.js
require('dotenv').config();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

async function registerMetadata() {
  const url = `https://discord.com/api/v10/applications/${CLIENT_ID}/role-connections/metadata`;
  
  // Aquí definimos oficialmente la etiqueta que saldrá en tu perfil de Discord
  const metadataSchema = [
    {
      key: 'is_rx',
      name: 'MT', // El nombre de la etiqueta
      description: 'Verifica si el usuario se identifica como tal',
      type: 7 // Tipo 7: BOOLEAN_EQUAL (SÍ/NO)
    }
  ];

  try {
    const response = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(metadataSchema),
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log('¡Metadatos registrados con éxito en los servidores de Discord!');
      const data = await response.json();
      console.log('Esquema registrado:', data);
    } else {
      const errorData = await response.json();
      console.error('❌ Error al registrar metadatos:', errorData);
    }
  } catch (error) {
    console.error('❌ Error de red:', error);
  }
}

registerMetadata();
