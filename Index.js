// index.js
require('dotenv').config();
const express = require('express');
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  ActivityType, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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
const LOG_CHANNEL_ID = process.env.DISCORD_LOG_CHANNEL_ID; // ID de tu canal de logs
const PANEL_CHANNEL_ID = process.env.DISCORD_PANEL_CHANNEL_ID; // ID del canal público donde irá el panel de registro

// ==========================================
// 🔑 CONFIGURACIÓN DE ROLES (IDs)
// ==========================================
// 1. ID del rol principal que se otorga en el Registro/Login tradicional
const ROLE_TO_GIVE_ID = '1527104876167958598'; 

// 2. ID del rol que obtienen al Vincular la App (Coloca aquí el ID del rol de vinculación)
const ROLE_VINCULADO_ID = '1527249141108048002'; 

// Enlace personalizado que abrirá el botón "Vincular App"
const URL_VINCULACION = 'https://bot-xb-aurora.onrender.com/login'; 

// Lista temporal en memoria para registrar usuarios con solicitudes pendientes de aprobación
const solicitudesPendientes = new Set();

// ==========================================
// 1. SISTEMA DE COMANDOS DEL BOT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // REQUERIDO para comprobar y otorgar roles
    GatewayIntentBits.GuildMessages, // REQUERIDO para leer el comando !rxlogin y !vincular
    GatewayIntentBits.MessageContent // REQUERIDO para leer el contenido de dichos mensajes
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
  console.log(`🤖 Xb Aurora Bot conectado como ${client.user.tag}`);
  registerSlashCommands();

  client.user.setPresence({
    activities: [{
      name: 'Xb Aurora Network 🚀',
      type: ActivityType.Watching
    }],
    status: 'online'
  });
});

// --- ESCUCHA DE MENSAJES (Para comandos tradicionales de administración) ---
client.on('messageCreate', async message => {
  // Evitamos que el bot se auto-responda o lea mensajes sin el prefijo correcto
  if (message.author.bot || !message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Verificación rápida de seguridad: Solo administradores pueden ejecutar estos setups
  if (!message.member.permissions.has('Administrator')) return;

  // 1. Comando: !rxlogin (Envía el Panel de Registro al canal configurado)
  if (command === 'rxlogin') {
    try {
      const targetChannel = await client.channels.fetch(PANEL_CHANNEL_ID);
      if (!targetChannel) {
        return message.reply('❌ No se pudo localizar el canal configurado en `DISCORD_PANEL_CHANNEL_ID`.');
      }

      const panelEmbed = new EmbedBuilder()
        .setColor('#0F0F14')
        .setTitle('▲ SISTEMA DE ACCESO: XB AURORA ▲')
        .setDescription(
          `Bienvenido a la red central de **Xb Aurora Network**.\n\n` +
          `Para desbloquear la totalidad del servidor y acceder a las salas públicas, es obligatorio realizar el proceso de registro técnico y vincular tu cuenta.\n\n` +
          `\`\`\`ini\n[Estatus del Servidor]: PROTEGIDO\n[Requisito]: Registro de identidad de red\n\`\`\`\n` +
          `Presiona el botón **Comenzar Registro 🚀** de abajo para iniciar. Si tienes problemas o dudas, utiliza el botón de **Soporte Técnico ⚙️**.`
        )
        .setThumbnail('https://i.imgur.com/8N6mGgN.png')
        .setFooter({ text: 'Xb Aurora Network • Protocolo de seguridad activo.' })
        .setTimestamp();

      const btnRegistro = new ButtonBuilder()
        .setCustomId('btn_open_registro')
        .setLabel('Comenzar Registro 🚀')
        .setStyle(ButtonStyle.Secondary);

      const btnSupport = new ButtonBuilder()
        .setCustomId('btn_open_support')
        .setLabel('Soporte Técnico ⚙️')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(btnRegistro, btnSupport);

      await targetChannel.send({ embeds: [panelEmbed], components: [row] });

      const confirmMsg = await message.reply(`✅ El panel de registro ha sido enviado exitosamente al canal <#${PANEL_CHANNEL_ID}>.`);
      setTimeout(() => {
        message.delete().catch(() => {});
        confirmMsg.delete().catch(() => {});
      }, 5000);

    } catch (err) {
      console.error('❌ Error en !rxlogin:', err);
      message.reply('❌ Ocurrió un error técnico al intentar desplegar el panel de registro.');
    }
  }

  // 2. Comando: !vincular (Envía el panel de vinculación pública al canal actual)
  if (command === 'vincular') {
    try {
      const vincularEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('▲ VINCULACIÓN COMPLEMENTARIA ▲')
        .setDescription(
          `Sincroniza tus datos de juego directamente con la infraestructura de **Xb Aurora Network**.\n\n` +
          `\`\`\`ini\n[Servicio]: Vinculador de Aplicación Externa\n[Requisito]: No estar vinculado previamente\n\`\`\`\n` +
          `Presiona **Vincular App 🔗** para enlazar tu perfil, o **Más Tarde ⏳** si prefieres omitir el proceso temporalmente.`
        )
        .setThumbnail('https://i.imgur.com/8N6mGgN.png')
        .setFooter({ text: 'Xb Aurora Network • Sincronización de credenciales.' })
        .setTimestamp();

      const btnVincular = new ButtonBuilder()
        .setCustomId('btn_intentar_vincular') // Pasa primero por la verificación del bot
        .setLabel('Vincular App 🔗')
        .setStyle(ButtonStyle.Primary);

      const btnMasTarde = new ButtonBuilder()
        .setCustomId('btn_cancelar_vinculo')
        .setLabel('Más Tarde ⏳')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(btnVincular, btnMasTarde);

      await message.channel.send({ embeds: [vincularEmbed], components: [row] });

      await message.delete().catch(() => {});
    } catch (err) {
      console.error('❌ Error en !vincular:', err);
      message.reply('❌ Ocurrió un error al enviar el panel de vinculación.');
    }
  }
});

// Procesador de interacciones (Comandos, Modales y Botones)
client.on('interactionCreate', async interaction => {
  // A. COMANDOS SLASH
  if (interaction.isChatInputCommand()) {
    try {
      await handleInteraction(interaction); 
    } catch (error) {
      console.error('❌ Error al ejecutar el comando:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Ocurrió un error al ejecutar este comando.', ephemeral: true });
      }
    }
    return;
  }

  // B. ENVÍO DEL FORMULARIO (MODAL SUBMIT)
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'login_modal') {
      const username = interaction.fields.getTextInputValue('modal_username');
      const userId = interaction.user.id;

      try {
        const member = await interaction.guild.members.fetch(userId);

        // Capa de seguridad 1: Comprobar si ya tiene el rol asignado de login tradicional
        if (member.roles.cache.has(ROLE_TO_GIVE_ID)) {
          return await interaction.reply({
            content: '❌ **Acceso denegado:** Tu cuenta ya se encuentra verificada en la red de Xb Aurora y posees el rol de acceso.',
            ephemeral: true
          });
        }

        // Capa de seguridad 2: Comprobar si ya tiene una solicitud pendiente de aprobación
        if (solicitudesPendientes.has(userId)) {
          return await interaction.reply({
            content: '⏳ **Solicitud duplicada:** Ya has enviado un formulario de registro. Por favor, espera a que un administrador apruebe tu solicitud actual.',
            ephemeral: true
          });
        }

        await interaction.reply({
          content: '⏳ Procesando tu solicitud de registro de red...',
          ephemeral: true
        });

        solicitudesPendientes.add(userId);

        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#111111')
            .setTitle('📥 NUEVA SOLICITUD DE REGISTRO')
            .setDescription('Se ha recibido un nuevo registro para vincular en la red.')
            .addFields(
              { name: '👤 Gamertag / Red', value: `\`${username}\``, inline: true },
              { name: '🆔 Cuenta de Discord', value: `${interaction.user} (\`${userId}\`)`, inline: true }
            )
            .setTimestamp();

          const verifyButton = new ButtonBuilder()
            .setCustomId(`verify_user_${userId}`)
            .setLabel('Verificar Usuario ✅')
            .setStyle(ButtonStyle.Success);

          const row = new ActionRowBuilder().addComponents(verifyButton);

          await logChannel.send({ embeds: [logEmbed], components: [row] });
        }

        // Editar la respuesta con el diseño estilo Black Mirror
        const loginUrl = `https://${client.user.username.toLowerCase()}-network.onrender.com/login`;
        
        const interfaceEmbed = new EmbedBuilder()
          .setColor('#0F0F14')
          .setTitle('▲ INTERFAZ AURORA CONECTADA ▲')
          .setDescription(
            `**PROCESO DE VINCULACIÓN EN CURSO**\n` +
            `*Identidad temporal validada para ${interaction.user.username}.*\n\n` +
            `\`\`\`ini\n[Status]: Esperando aprobación administrativa.\n[Protocolo]: Registro de red enviado.\n\`\`\`\n` +
            `Para finalizar la vinculación externa, puedes ingresar al portal seguro de Render:`
          );

        const actionButton = new ButtonBuilder()
          .setLabel('CONFIRMAR LOGIN OAUTH2 🚀')
          .setURL(loginUrl)
          .setStyle(ButtonStyle.Link);

        const rowUser = new ActionRowBuilder().addComponents(actionButton);

        await interaction.editReply({
          content: null,
          embeds: [interfaceEmbed],
          components: [rowUser]
        });

      } catch (err) {
        console.error('❌ Error al procesar el modal:', err);
        if (!interaction.replied) {
          await interaction.reply({ content: 'Ocurrió un error procesando tu solicitud.', ephemeral: true });
        }
      }
    }
    return;
  }

  // C. INTERACCIONES CON BOTONES
  if (interaction.isButton()) {
    const userId = interaction.user.id;

    // 1. Botón "Comenzar Registro" en el panel público
    if (interaction.customId === 'btn_open_registro') {
      try {
        const member = await interaction.guild.members.fetch(userId);

        if (member.roles.cache.has(ROLE_TO_GIVE_ID)) {
          return await interaction.reply({
            content: '❌ **Acceso denegado:** Tu cuenta ya se encuentra verificada y posees el rol de acceso.',
            ephemeral: true
          });
        }

        if (solicitudesPendientes.has(userId)) {
          return await interaction.reply({
            content: '⏳ **Solicitud en cola:** Ya has enviado tu registro. Espera a que un administrador valide tu cuenta actual.',
            ephemeral: true
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('login_modal')
          .setTitle('SISTEMA AURORA: REGISTRO');

        const usernameInput = new TextInputBuilder()
          .setCustomId('modal_username')
          .setLabel('NOMBRE DE USUARIO / GAMERTAG')
          .setPlaceholder('Ingresa tu identificador principal aquí...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(row);

        return await interaction.showModal(modal);

      } catch (err) {
        console.error('❌ Error al abrir modal:', err);
        return await interaction.reply({ content: 'Hubo un error al cargar el formulario de registro.', ephemeral: true });
      }
    }

    // 2. Botón "Soporte Técnico" en el panel público
    if (interaction.customId === 'btn_open_support') {
      const supportEmbed = new EmbedBuilder()
        .setColor('#E81123')
        .setTitle('⚙️ SOPORTE DE RED: AURORA')
        .setDescription(
          `**¿Necesitas ayuda con el registro?**\n\n` +
          `1. Introduce tu Gamertag/Nombre de usuario sin caracteres raros o especiales.\n` +
          `2. Si el formulario no carga, prueba reiniciando tu app de Discord.\n` +
          `3. Al finalizar, espera a que el staff valide manualmente tu acceso.\n\n` +
          `Si presentas fallas adicionales de red, contacta directamente a la administración.`
        );

      return await interaction.reply({ embeds: [supportEmbed], ephemeral: true });
    }

    // 3. Botón "Vincular App" (Validación de rol exclusiva para vinculación de App activa 🔗)
    if (interaction.customId === 'btn_intentar_vincular') {
      try {
        const member = await interaction.guild.members.fetch(userId);

        // AQUÍ USA EL ROL EXCLUSIVO PARA LA APP
        if (member.roles.cache.has(ROLE_VINCULADO_ID)) {
          return await interaction.reply({
            content: '❌ **Operación Prohibida:** Tu cuenta de Discord ya ha sido vinculada con la aplicación de Xb Aurora anteriormente. No es posible asociar más de una vez.',
            ephemeral: true
          });
        }

        // Si NO tiene el rol, le mostramos el botón directo de redirección para que se vincule
        const redirectionEmbed = new EmbedBuilder()
          .setColor('#00FF1F')
          .setTitle('🔗 ENLACE DE VINCULACIÓN CONFIGURADO')
          .setDescription(
            `Tu identidad temporal ha sido analizada con éxito.\n` +
            `Presiona el botón que aparece a continuación para acceder al portal externo y finalizar la vinculación:`
          );

        const redirectButton = new ButtonBuilder()
          .setLabel('Confirmar Sincronización Externa ⚙️')
          .setURL(URL_VINCULACION)
          .setStyle(ButtonStyle.Link);

        const row = new ActionRowBuilder().addComponents(redirectButton);

        return await interaction.reply({
          embeds: [redirectionEmbed],
          components: [row],
          ephemeral: true
        });

      } catch (err) {
        console.error('❌ Error en interacción de vinculación:', err);
        return await interaction.reply({ content: 'Ocurrió un error al validar tu información de red.', ephemeral: true });
      }
    }

    // 4. Botón "Más Tarde" en el panel de vinculación
    if (interaction.customId === 'btn_cancelar_vinculo') {
      return await interaction.reply({
        content: '⚙️ **Operación suspendida:** Proceso omitido. Recuerda vincular tu aplicación cuando estés listo para no perder accesos.',
        ephemeral: true
      });
    }

    // 5. Botón del canal de Logs (El Administrador aprueba la solicitud tradicional)
    if (interaction.customId.startsWith('verify_user_')) {
      const targetUserId = interaction.customId.replace('verify_user_', '');
      
      await interaction.deferUpdate();

      try {
        const guild = interaction.guild;
        const member = await guild.members.fetch(targetUserId);
        const role = await guild.roles.fetch(ROLE_TO_GIVE_ID);

        if (!role) {
          return await interaction.followUp({ content: '❌ El rol especificado no existe.', ephemeral: true });
        }

        if (member) {
          await member.roles.add(role);
          solicitudesPendientes.delete(targetUserId);

          const originalEmbed = interaction.message.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor('#00FF1F')
            .setTitle('✅ SOLICITUD APROBADA')
            .addFields({ name: '⚡ Estado', value: `Verificado y rol otorgado por: ${interaction.user}` });

          await interaction.message.edit({
            embeds: [updatedEmbed],
            components: [] // Eliminamos el botón de verificar
          });
        }
      } catch (err) {
        console.error('❌ Error al otorgar rol:', err);
        await interaction.followUp({ content: '❌ No se pudo otorgar el rol. Verifica la jerarquía del bot.', ephemeral: true });
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
  res.send('bi bot está online 🟢');
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
