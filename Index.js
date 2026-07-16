require('dotenv').config();
const express = require('express');
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  ActivityType
} = require('discord.js');

// Importamos nuestros comandos separados desde commands.js
const { commandsList, handleInteraction } = require('./commands.js');

const app = express();

// --- CONFIGURACIÓN DE VARIABLES DE ENTORNO ---
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

// ==========================================
// 1. SISTEMA DE COMANDOS DEL BOT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// Registrar comandos slash
async function registerSlashCommands() {
  if (!BOT_TOKEN || !CLIENT_ID) {
    console.error('❌ Faltan credenciales para registrar comandos.');
    return;
  }
  
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    console.log('🔄 Registrando comandos "/" en Discord...');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commandsList }
    );
    console.log('✅ ¡Comandos "/" registrados con éxito!');
  } catch (error) {
    console.error('❌ Error al registrar comandos:', error);
  }
}

client.once('ready', () => {
  console.log(`🤖 Bi Bot conectado como ${client.user.tag}`);
  registerSlashCommands();

  client.user.setPresence({
    activities: [{
      name: 'Host By Chris Mt',
      type: ActivityType.Watching
    }],
    status: 'online'
  });
});

// Procesador de interacciones (Delegado completamente a commands.js)
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    try {
      // Toda la lógica y respuestas de los comandos ocurren dentro de commands.js
      await handleInteraction(interaction); 
    } catch (error) {
      console.error('❌ Error al ejecutar el comando desde commands.js:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Ocurrió un error al ejecutar este comando.', ephemeral: true });
      }
    }
  }
});

if (BOT_TOKEN) {
  client.login(BOT_TOKEN).catch(err => console.error('❌ Error login:', err));
}

// ==========================================
// 2. TU SISTEMA DE VERIFICACIÓN WEB (OAUTH2)
// ==========================================
app.get('/', (req, res) => {
  res.send('Bi Bot está online 🟢');
});

app.get('/login', (req, res) => {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20role_connections.write`;
  res.redirect(discordAuthUrl);
});

app.get('/discord-oauth-callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No se proporcionó el código de verificación.');
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      throw new Error(`Error al obtener token de Discord: ${errBody}`);
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    const connectionUrl = `https://discord.com/api/v10/users/@me/applications/${CLIENT_ID}/role-connection`;
    
    const updateResponse = await fetch(connectionUrl, {
      method: 'PUT',
      body: JSON.stringify({
        platform_name: 'Bi Bot',
        platform_username: 'Beta',
        metadata: {
          is_rx: 1 
        }
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (updateResponse.ok) {
      res.send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h1 style="color: #5865F2;">¡Xb Aurora Conectado!</h1>
          <p>Tu cuenta se ha verificado y vinculado correctamente.</p>
          <p>Ya puedes cerrar esta pestaña y revisar tu perfil de Discord.</p>
        </div>
      `);
    } else {
      const errDetails = await updateResponse.json();
      console.error('Error al actualizar metadatos:', errDetails);
      res.status(500).send('Error al intentar guardar tu conexión en Discord.');
    }

  } catch (error) {
    console.error('Error en el proceso de autenticación:', error);
    res.status(500).send('Ocurrió un error inesperado en el servidor.');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor de Xb Aurora corriendo en el puerto ${PORT}`);
});

// Escudo contra caídas
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [ERROR] Promesa rechazada en:', promise, 'razón:', reason);
});
process.on('uncaughtException', (err, origin) => {
  console.error('⚠️ [ERROR] Excepción no capturada:', err, 'en:', origin);
});
                    
