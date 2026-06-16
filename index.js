const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Nếu trên Render thì lấy từ biến môi trường, trên máy thì lấy từ file JSON
const creds = process.env.GOOGLE_CREDS ? JSON.parse(process.env.GOOGLE_CREDS) : require('./credentials.json');

const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet('ID_SHEET_CUA_BAN_O_BUOC_1', serviceAccountAuth);

async function getBalance(userId) {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('userId') === userId);
    return row ? parseInt(row.get('balance')) : 0;
}

async function updateBalance(userId, amount) {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    let row = rows.find(r => r.get('userId') === userId);
    
    if (row) {
        row.set('balance', amount);
        await row.save();
    } else {
        await sheet.addRow({ userId: userId, balance: amount });
    }
}
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ComponentType, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const express = require('express');

// 1. WEB SERVER CHUẨN ĐỂ ĐÓN PING CRON-JOB TRÊN RENDER
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot Giải Đấu Sea Coins Toán Học đang chạy 24/7!'));
app.listen(PORT, '0.0.0.0', () => console.log(`[WEB] Server đang chạy mượt mà trên port ${PORT}`));

// 2. CẤU HÌNH BOT DISCORD
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Cơ sở dữ liệu bộ nhớ tạm cho ví tiền Sea Coins (🪙)
const seaCoinsBalances = {}; 
let isTournamentRunning = false; // Trạng thái kiểm soát giải đấu toàn cục
let currentRoundCollector = null; // Biến lưu trữ bộ quét chat hiện tại để có thể ép dừng từ xa

// 3. ĐĂNG KÝ HỆ THỐNG SLASH COMMANDS
const commands = [
    new SlashCommandBuilder()
        .setName('batdau')
        .setDescription('Khởi động một GIẢI ĐẤU TOÁN HỌC 20 VÒNG và mở hòm phiếu bầu chọn!'),
    new SlashCommandBuilder()
        .setName('vi')
        .setDescription('Kiểm tra số dư túi tiền Sea Coins hiện tại của bạn'),
    new SlashCommandBuilder()
        .setName('setxu')
        .setDescription('Thay đổi số xu Sea Coins của một ai đó (Chỉ dành cho Admin/Chủ server)')
        .addUserOption(option => option.setName('user').setDescription('Thành viên nhận/bị trừ xu').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('Số xu mới muốn thiết lập').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('ketthuc')
        .setDescription('Cưỡng ép DỪNG LẬP TỨC giải đấu toán học hiện tại (Mở khóa cho TẤT CẢ MỌI NGƯỜI)')
        // ĐÃ XÓA dòng setDefaultMemberPermissions để AI CŨNG CÓ THỂ SỬ DỤNG
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[HỆ THỐNG] Đã đăng nhập thành công: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[HỆ THỐNG] Đã mở khóa lệnh /ketthuc cho tất cả mọi người chơi!');
    } catch (error) {
        console.error("Lỗi đồng bộ lệnh:", error);
    }
});

// 4. THUẬT TOÁN RA ĐỀ TOÁN TỰ ĐỘNG THEO TIÊU CHUẨN GỐC
const randomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function generateSeaMath(difficulty) {
    let questionText = '';
    let correctAnswer = 0;

    if (difficulty === 'de') {
        const n1 = randomNum(10, 99);
        const n2 = randomNum(10, 99);
        const op = Math.random() > 0.5 ? '+' : '-';
        if (op === '+') { correctAnswer = n1 + n2; questionText = `${n1} + ${n2}`; }
        else {
            let max = Math.max(n1, n2); let min = Math.min(n1, n2);
            correctAnswer = max - min; questionText = `${max} - ${min}`;
        }
    } 
    else if (difficulty === 'trungbinh') {
        const op1 = ['+', '-'][randomNum(0, 1)];
        const n1 = randomNum(100, 999); const n2 = randomNum(100, 999); const n_nhan = randomNum(2, 9);
        
        if (Math.random() > 0.5) {
            let tich = n2 * n_nhan;
            questionText = `${n1} ${op1} (${n2} x ${n_nhan})`;
            correctAnswer = op1 === '+' ? n1 + tich : n1 - tich;
        } else {
            let tich = n1 * n_nhan;
            questionText = `(${n1} x ${n_nhan}) ${op1} ${n2}`;
            correctAnswer = op1 === '+' ? tich + n2 : tich - n2;
        }
    } 
    else if (difficulty === 'kho') {
        const numOps = randomNum(2, 4); 
        let expression = ''; 
        let currentVal = randomNum(10, 200); 
        expression += currentVal;

        for (let i = 0; i < numOps; i++) {
            const op = ['+', '-', '*', '/'][randomNum(0, 3)]; let nextNum;
            if (op === '/') {
                nextNum = randomNum(2, 12);
                let tempExpression = expression + ` * ${nextNum}`;
                try { currentVal = eval(tempExpression); } catch(e){}
                expression = `(${expression}) / ${nextNum}`;
            } else if (op === '*') {
                nextNum = randomNum(2, 9); expression = `(${expression}) * ${nextNum}`;
            } else {
                nextNum = randomNum(10, 500); expression = `${expression} ${op} ${nextNum}`;
            }
        }
        try { correctAnswer = eval(expression); } catch (e) { correctAnswer = 100; expression = '500 + 200 - 600'; }
        questionText = expression.replace(/\*/g, 'x').replace(/\//g, ':');
    }
    return { text: questionText, answer: correctAnswer };
}

// 5. ĐIỀU KHIỂN SỰ KIỆN TƯƠNG TÁC LỆNH GÕ
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, user, options } = interaction;
    const userId = user.id;

    try {
        if (commandName === 'vi') {
            const bal = seaCoinsBalances[userId] || 0;
            const embedVi = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('🪙 TÀI KHOẢN SEA COINS')
                .setDescription(`Chào <@${userId}>, số dư hiện tại của bạn là: **${bal} Sea Coins**`)
                .setTimestamp();
            return interaction.reply({ embeds: [embedVi] });
        }

        if (commandName === 'setxu') {
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            seaCoinsBalances[targetUser.id] = amount;
            
            const embedSet = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🔧 ĐIỀU CHỈNH HỆ THỐNG')
                .setDescription(`Admin đã thiết lập lại số dư của <@${targetUser.id}> thành **${amount} Sea Coins** 🪙.`);
            return interaction.reply({ embeds: [embedSet] });
        }

        // LỆNH ÉP DỪNG GIẢI ĐẤU (BẤT KỲ AI CŨNG CÓ THỂ GÕ)
        if (commandName === 'ketthuc') {
            if (!isTournamentRunning) {
                return interaction.reply({ content: '⚠️ Hiện tại không có giải đấu nào đang diễn ra để kết thúc.', ephemeral: true });
            }

            isTournamentRunning = false;
            if (currentRoundCollector) {
                currentRoundCollector.stop('forced_end');
            }

            const embedForcedEnd = new EmbedBuilder()
                .setColor(0xD35400)
                .setTitle('🛑 GIẢI ĐẤU ĐÃ BỊ DỪNG')
                .setDescription(`Thành viên <@${userId}> đã sử dụng lệnh \`/ketthuc\` để hủy trận đấu!\n\nSố dư Sea Coins bạn tích lũy được từ các vòng trước đó vẫn được lưu an toàn trong ví.`);

            return interaction.reply({ embeds: [embedForcedEnd] });
        }

        if (commandName === 'batdau') {
            if (isTournamentRunning) {
                return interaction.reply({ content: '⚠️ Hệ thống đang chạy một giải đấu rồi! Không thể mở thêm giải đấu song song.', ephemeral: true });
            }

            await interaction.deferReply().catch(err => console.error("Lỗi hoãn reply:", err));
            isTournamentRunning = true; 

            const votes = { de: new Set(), trungbinh: new Set(), kho: new Set() };

            const btnDe = new ButtonBuilder().setCustomId('votede').setLabel('🟢 Dễ (0)').setStyle(3);
            const btnTrungBinh = new ButtonBuilder().setCustomId('votetrungbinh').setLabel('🟡 Trung Bình (0)').setStyle(4);
            const btnKho = new ButtonBuilder().setCustomId('votekho').setLabel('🔴 Khó (0)').setStyle(2);

            const row = new ActionRowBuilder().addComponents(btnDe, btnTrungBinh, btnKho);

            const voteEndTime = Math.floor((Date.now() + 30000) / 1000);

            const embedStart = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle('🏆 GIẢI ĐẤU TOÁN HỌC SEA COINS ĐÃ MỞ')
                .setDescription(`Các anh tài bấm nút phía dưới để biểu quyết chọn độ khó chung cho giải đấu lần này!\n\n⏱️ **Thời gian đóng hòm phiếu:** <t:${voteEndTime}:R>`)
                .setFooter({ text: 'Giải đấu tự động vận hành bởi Sea Math Engine' });

            const voteMessage = await interaction.editReply({
                embeds: [embedStart],
                components: [row]
            }).catch(err => console.error("Lỗi gửi bảng vote:", err));

            if (!voteMessage) {
                isTournamentRunning = false;
                return;
            }

            const voteCollector = voteMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 30000
            });

            voteCollector.on('collect', async (btnInteract) => {
                if (!isTournamentRunning) {
                    return voteCollector.stop('forced_end');
                }

                const vterId = btnInteract.user.id;
                const clickedId = btnInteract.customId;
                
                let chosenDiff = 'de';
                if (clickedId === 'votetrungbinh') chosenDiff = 'trungbinh';
                if (clickedId === 'votekho') chosenDiff = 'kho';

                for (const diff in votes) { votes[diff].delete(vterId); }
                votes[chosenDiff].add(vterId);

                const uRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('votede').setLabel(`🟢 Dễ (${votes.de.size})`).setStyle(3),
                    new ButtonBuilder().setCustomId('votetrungbinh').setLabel(`🟡 Trung Bình (${votes.trungbinh.size})`).setStyle(4),
                    new ButtonBuilder().setCustomId('votekho').setLabel(`🔴 Khó (${votes.kho.size})`).setStyle(2)
                );
                
                await btnInteract.update({ components: [uRow] }).catch(() => {});
            });

            voteCollector.on('end', async (collected, reason) => {
                if (reason === 'forced_end') return; 

                let finalDiff = 'de'; 
                let maxVotes = votes.de.size;
                
                if (votes.trungbinh.size > maxVotes) { finalDiff = 'trungbinh'; maxVotes = votes.trungbinh.size; }
                if (votes.kho.size > maxVotes) { finalDiff = 'kho'; }

                let reward = 15; let initialLives = 5; let diffLabel = '🟢 DỄ (15🪙/câu | 5 Mạng | 20s)';
                let colorHex = 0x2ECC71;
                if (finalDiff === 'trungbinh') { reward = 50; initialLives = 3; diffLabel = '🟡 TRUNG BÌNH (50🪙/câu | 3 Mạng | 20s)'; colorHex = 0xF1C40F; }
                if (finalDiff === 'kho') { reward = 100; initialLives = 2; diffLabel = '🔴 KHÓ VÔ HẠN (100🪙/câu | 2 Mạng | 20s)'; colorHex = 0xE74C3C; }

                const embedEndVote = new EmbedBuilder()
                    .setColor(colorHex)
                    .setTitle('🔔 THỜI GIAN BẦU CHỌN KẾT THÚC')
                    .setDescription(`Đa số tuyển thủ đã chốt cấp độ: **${diffLabel}**.\n\n🚀 **TRẬN ĐẤU CHÍNH THỨC BẮT ĐẦU SAU 3 GIÂY!**`);

                await interaction.followUp({ embeds: [embedEndVote] }).catch(() => {});

                runTournamentRound(interaction.channel, finalDiff, initialLives, reward, 1, {});
            });
        }
    } catch (globalError) {
        console.error("Lỗi Interaction tổng cục:", globalError);
        isTournamentRunning = false;
    }
});

// 6. HÀM CHẠY VÒNG ĐẤU TOÁN HỌC LIÊN TỤC
async function runTournamentRound(channel, difficulty, initialLives, reward, currentRound, tournamentStats) {
    if (!isTournamentRunning) return;
    if (currentRound > 20) { return endTournament(channel, tournamentStats); }

    await new Promise(resolve => setTimeout(resolve, 2500)); 
    if (!isTournamentRunning) return; 

    try {
        const qData = generateSeaMath(difficulty);
        console.log(`[LOG VÒNG ${currentRound}] Đề: ${qData.text} | Đáp án: ${qData.answer}`);

        const roundDuration = 20000; 
        const roundEndTime = Math.floor((Date.now() + roundDuration) / 1000);

        const embedQuestion = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`⚔️ VÒNG ĐẤU: ${currentRound} / 20 ⚔️`)
            .setDescription(`Hãy tính giá trị của biểu thức toán học sau:\n\n👉  **\`${qData.text}\` = ?** 👈\n\n⏱️ **Thời gian giới hạn:** <t:${roundEndTime}:R>`)
            .setFooter({ text: `Phần thưởng vòng: ${reward} Sea Coins 🪙 | Bạn chỉ có đúng 20 giây!` });

        await channel.send({ embeds: [embedQuestion] });

        const playerLives = {};
        const activePlayersInRound = new Set();

        currentRoundCollector = channel.createMessageCollector({
            filter: m => !m.author.bot,
            time: roundDuration
        });

        currentRoundCollector.on('collect', async (m) => {
            const pId = m.author.id;
            const userAnswer = parseInt(m.content.trim());

            if (isNaN(userAnswer)) return; 

            if (playerLives[pId] === undefined) {
                playerLives[pId] = initialLives;
                activePlayersInRound.add(pId);
            }

            if (playerLives[pId] <= 0) return;

            if (userAnswer === qData.answer) {
                currentRoundCollector.stop('winner');
                if (!seaCoinsBalances[pId]) seaCoinsBalances[pId] = 0;
                if (!tournamentStats[pId]) tournamentStats[pId] = 0;

                seaCoinsBalances[pId] += reward;
                tournamentStats[pId] += reward; 

                const embedWin = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`🎉 VÒNG ${currentRound} ĐÃ CÓ NHÀ VÔ ĐỊCH 🎉`)
                    .setDescription(`👑 <@${pId}> đã nổ đáp án chính xác: **\`${qData.answer}\`**\n💰 Tài khoản cá nhân nhận ngay **+${reward} Sea Coins** 🪙.`);
                return m.reply({ embeds: [embedWin] }).catch(() => {});
            }

            playerLives[pId]--;

            if (playerLives[pId] <= 0) {
                const embedEliminated = new EmbedBuilder()
                    .setColor(0xE74C3C)
                    .setDescription(`💥 <@${pId}> đã gõ sai (\`${userAnswer}\`) và **CHÍNH THỨC BỊ LOẠI** tại vòng ${currentRound}! ❌`);
                m.reply({ embeds: [embedEliminated] }).catch(() => {});
                
                const anyoneAlive = Array.from(activePlayersInRound).some(id => playerLives[id] > 0);
                if (!anyoneAlive && activePlayersInRound.size > 0) {
                    currentRoundCollector.stop('all_dead');
                }
            } else {
                return m.reply(`❌ **Kết quả chưa chính xác!** Bạn gõ số \`${userAnswer}\`.\n⚠️ Số mạng còn lại: **${'❤️'.repeat(playerLives[pId])}**`).catch(() => {});
            }
        });

        currentRoundCollector.on('end', async (collected, reason) => {
            if (reason === 'forced_end') return; 

            if (reason === 'time') {
                const embedTimeout = new EmbedBuilder()
                    .setColor(0x7F8C8D)
                    .setTitle('⏱️ HẾT 20 GIÂY QUY ĐỊNH')
                    .setDescription(`Tốc độ quá nhanh! Không anh tài nào giải kịp bài toán.\n🤖 Đáp án chuẩn xác là: **\`${qData.answer}\`**`);
                await channel.send({ embeds: [embedTimeout] });
            } 
            else if (reason === 'all_dead') {
                const embedAllDead = new EmbedBuilder()
                    .setColor(0x34495E)
                    .setTitle('💀 TẤT CẢ ĐỀ VỀ VƯỜN')
                    .setDescription(`Toàn bộ người chơi tham gia vòng này đều đã cạn sạch mạng.\n🤖 Đáp án đúng là: **\`${qData.answer}\`**`);
                await channel.send({ embeds: [embedAllDead] });
            }

            await new Promise(resolve => setTimeout(resolve, 1500));
            if (!isTournamentRunning) return; 

            if (currentRound < 20) {
                await channel.send(`⏩ *Hệ thống đang chuẩn bị dữ liệu Vòng ${currentRound + 1}...*`);
            }
            
            runTournamentRound(channel, difficulty, initialLives, reward, currentRound + 1, tournamentStats);
        });

    } catch (roundError) {
        console.error(`Lỗi vòng ${currentRound}:`, roundError);
        if (isTournamentRunning) {
            runTournamentRound(channel, difficulty, initialLives, reward, currentRound + 1, tournamentStats);
        }
    }
}

// 7. TỔNG KẾT BẢNG XẾP HẠNG GIẢI ĐẤU
async function endTournament(channel, tournamentStats) {
    isTournamentRunning = false; 

    const leaderboard = Object.entries(tournamentStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); 

    const embedLeaderboard = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('🏆 BẢNG XẾP HẠNG GIẢI ĐẤU TOÁN HỌC SEA COINS 🏆')
        .setTimestamp();

    if (leaderboard.length === 0) {
        embedLeaderboard.setDescription('*Thật đáng tiếc, giải đấu kết thúc mà không một ai tích lũy được Sea Coins nào!*');
    } else {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        let leaderboardText = '';
        leaderboard.forEach(([pId, coins], index) => {
            leaderboardText += `${medals[index]} <@${pId}>: Tích lũy **+${coins} Sea Coins** 🪙\n`;
        });
        embedLeaderboard.setDescription(leaderboardText);
    }

    await channel.send({ embeds: [embedLeaderboard] }).catch(() => {});
    await channel.send('✨ **Trận đấu khép lại hoàn chỉnh!** Các bạn có thể gõ `/batdau` để thực hiện một giải đấu mới tinh nhé!');
}

client.login(process.env.DISCORD_TOKEN);
