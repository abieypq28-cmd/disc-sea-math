const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');

// 1. WEB SERVER GIỮ BOT LUÔN ONLINE ON RENDER
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Giải Đấu Sea Coins Toán Học đang chạy 24/7!'));
app.listen(PORT, () => console.log(`Web server đang chạy trên port ${PORT}`));

// 2. CẤU HÌNH KHỞI TẠO BOT
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

// 3. ĐĂNG KÝ HỆ THỐNG COMMAND LỆNH ỨNG DỤNG (SLASH COMMANDS)
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Khóa quyền, chỉ Admin nhìn thấy
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[HỆ THỐNG] Đã đăng nhập thành công: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[HỆ THỐNG] Đã đồng bộ cấu trúc Slash Commands với Discord API!');
    } catch (error) {
        console.error(error);
    }
});

// 4. THUẬT TOÁN TỰ ĐỘNG RA ĐỀ TOÁN THEO TIÊU CHUẨN YÊU CẦU
const randomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function generateSeaMath(difficulty) {
    let questionText = '';
    let correctAnswer = 0;

    if (difficulty === 'de') {
        // CẤP ĐỘ DỄ: Cộng trừ 2 chữ số trở xuống, chỉ duy nhất 1 phép tính
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
        // CẤP ĐỘ TRUNG BÌNH: 2 phép tính, số từ 3 chữ số trở xuống, kết hợp cộng trừ và nhân 1 chữ số
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
        // CẤP ĐỘ KHÓ: Có từ 2 đến 4 phép tính đan xen, đầy đủ + - x :, số từ 3 chữ số trở xuống
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

    // LỆNH CHECK VÍ TIỀN TỆ (/vi)
    if (commandName === 'vi') {
        const bal = seaCoinsBalances[userId] || 0;
        return interaction.reply(`🪙 **Tài khoản cá nhân:** Bạn đang sở hữu **${bal} Sea Coins**.`);
    }

    // LỆNH THAY ĐỔI TIỀN CỦA ADMIN (/setxu)
    if (commandName === 'setxu') {
        const targetUser = options.getUser('user');
        const amount = options.getInteger('amount');
        seaCoinsBalances[targetUser.id] = amount;
        return interaction.reply(`🔧 **Hệ thống Quản Trị:** Admin đã điều chỉnh ví của <@${targetUser.id}> thành **${amount} Sea Coins** 🪙.`);
    }

    // LỆNH MỞ GIẢI ĐẤU (/batdau)
    if (commandName === 'batdau') {
        if (isTournamentRunning) {
            return interaction.reply({ content: '⚠️ Hệ thống đang chạy một giải đấu rồi! Không thể mở thêm giải đấu song song.', ephemeral: true });
        }

        isTournamentRunning = true; // Khóa chốt hệ thống
        const votes = { de: new Set(), trungbinh: new Set(), kho: new Set() };

        const btnDe = new ButtonBuilder().setCustomId('vote_de').setLabel('🟢 Dễ (0)').setStyle(ButtonStyle.Success);
        const btnTrungBinh = new ButtonBuilder().setCustomId('vote_trungbinh').setLabel('🟡 Trung Bình (0)').setStyle(ButtonStyle.Warning);
        const btnKho = new ButtonBuilder().setCustomId('vote_kho').setLabel('🔴 Khó (0)').setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(btnDe, btnTrungBinh, btnKho);

        const voteMessage = await interaction.reply({
            content: `🏆 **KHỞI ĐỘNG GIẢI ĐẤU TOÁN HỌC SEA COINS (20 VÒNG)** 🏆\nCác kỳ phùng thủ hãy có **30 giây** để bỏ phiếu biểu quyết độ khó chung cho toàn bộ giải đấu này!`,
            components: [row],
            fetchReply: true
        });

        const voteCollector = voteMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        voteCollector.on('collect', async (btnInteract) => {
            const vterId = btnInteract.user.id;
            const chosenDiff = btnInteract.customId.split('_')[1];
            for (const diff in votes) { votes[diff].delete(vterId); }
            votes[chosenDiff].add(vterId);

            const uRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('vote_de').setLabel(`🟢 Dễ (${votes.de.size})`).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('vote_trungbinh').setLabel(`🟡 Trung Bình (${votes.trungbinh.size})`).setStyle(ButtonStyle.Warning),
                new ButtonBuilder().setCustomId('vote_kho').setLabel(`🔴 Khó (${votes.kho.size})`).setStyle(ButtonStyle.Danger)
            );
            await btnInteract.update({ components: [uRow] });
        });

        voteCollector.on('end', async () => {
            let finalDiff = 'de'; let maxVotes = votes.de.size;
            if (votes.trungbinh.size > maxVotes) { finalDiff = 'trungbinh'; maxVotes = votes.trungbinh.size; }
            if (votes.kho.size > maxVotes) { finalDiff = 'kho'; }

            let reward = 15; let initialLives = 5; let diffLabel = '🟢 DỄ (Ăn 15🪙/câu | 5 ❤️/vòng)';
            if (finalDiff === 'trungbinh') { reward = 50; initialLives = 3; diffLabel = '🟡 TRUNG BÌNH (Ăn 50🪙/câu | 3 ❤️/vòng)'; }
            if (finalDiff === 'kho') { reward = 100; initialLives = 2; diffLabel = '🔴 KHÓ VÔ HẠN (Ăn 100🪙/câu | 2 ❤️/vòng)'; }

            await interaction.followUp({
                content: `🔔 **Hết giờ bầu chọn!** Đa số biểu quyết đã chốt cấp độ: **${diffLabel}**.\n🚀 **GIẢI ĐẤU CHÍNH THỨC KHỞI TRANH SAU 3 GIÂY!**`
            });

            // Triển khai đệ quy vòng 1
            runTournamentRound(interaction.channel, finalDiff, initialLives, reward, 1, {});
        });
    }
});

// 6. HÀM CHẠY VÒNG ĐẤU TOÁN HỌC LIÊN TỤC 
async function runTournamentRound(channel, difficulty, initialLives, reward, currentRound, tournamentStats) {
    if (currentRound > 20) { return endTournament(channel, tournamentStats); }

    await new Promise(resolve => setTimeout(resolve, 3000)); // Thời gian hồi sức 3 giây giữa mỗi vòng

    const qData = generateSeaMath(difficulty);
    console.log(`[DEBUG LOG] Vòng ${currentRound} | Đề: ${qData.text} | Đáp án gốc: ${qData.answer}`);

    await channel.send({
        content: `⚔️ **VÒNG ĐẤU: ${currentRound} / 20** ⚔️\n\n🔢 **ĐỀ BÀI:** Tính giá trị của biểu thức toán học sau:\n👉  **${qData.text} = ?** 👈\n\n⏱️ *Thời gian: **45 giây**. Hãy gõ trực tiếp kết quả số! Gõ sai quá số mạng cá nhân quy định sẽ bị loại.*`
    });

    const playerLives = {};
    const activePlayersInRound = new Set();

    const chatCollector = channel.createMessageCollector({
        filter: m => !m.author.bot,
        time: 45000
    });

    chatCollector.on('collect', async (m) => {
        const pId = m.author.id;
        const userAnswer = parseInt(m.content.trim());

        if (isNaN(userAnswer)) return; // Không quan tâm tin nhắn dạng văn bản chữ

        // Ghi danh người chơi mới nhập cuộc ở vòng đấu này
        if (playerLives[pId] === undefined) {
            playerLives[pId] = initialLives;
            activePlayersInRound.add(pId);
        }

        // Kiểm tra xem người này trước đó đã cạn mạng chưa
        if (playerLives[pId] <= 0) {
            return m.reply(`🚫 Bạn đã hết sạch mạng ở vòng này rồi! Vui lòng giữ trật tự chờ vòng tiếp theo nhé.`);
        }

        // TRƯỜNG HỢP 1: THÀNH CÔNG ĐOÁN ĐÚNG ĐÁP ÁN ĐẦU TIÊN
        if (userAnswer === qData.answer) {
            chatCollector.stop('winner');
            if (!seaCoinsBalances[pId]) seaCoinsBalances[pId] = 0;
            if (!tournamentStats[pId]) tournamentStats[pId] = 0;

            seaCoinsBalances[pId] += reward;
            tournamentStats[pId] += reward; 

            return m.reply(`🎉 **XUẤT SẮC THẮNG VÒNG ${currentRound}!** 🎉\n👑 <@${pId}> đã nổ đáp án chuẩn xác nhất: **${qData.answer}**.\n💰 Tài khoản được cộng **+${reward} Sea Coins** 🪙.`);
        }

        // TRƯỜNG HỢP 2: ĐOÁN SAI KẾT QUẢ
        playerLives[pId]--;

        if (playerLives[pId] <= 0) {
            m.reply(`💥 <@${pId}> đã gõ sai (${userAnswer}) và **CHÍNH THỨC BỊ LOẠI THI ĐẤU** tại vòng ${currentRound}! ❌`);
            
            // Xem xem tất cả những người nãy giờ cày ở vòng này đã "ngỏm" hết chưa
            const anyoneAlive = Array.from(activePlayersInRound).some(id => playerLives[id] > 0);
            if (!anyoneAlive && activePlayersInRound.size > 0) {
                chatCollector.stop('all_dead');
            }
        } else {
            return m.reply(`❌ **Kết quả sai!** <@${pId}> gõ số ${userAnswer}.\n⚠️ Mạng cá nhân của riêng bạn hiện tại còn: **${'❤️'.repeat(playerLives[pId])}**`);
        }
    });

    chatCollector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            await channel.send(`⏱️ **Hết thời gian quy định!** Không anh tài nào giải kịp.\n🤖 Đáp án chuẩn là: **${qData.answer}**.`);
        } 
        else if (reason === 'all_dead') {
            await channel.send(`💀 **TẤT CẢ ĐỀU BỊ LOẠI!** Toàn bộ người tham gia vòng này đều đã cạn sạch mạng.\n🤖 Đáp án của bài toán là: **${qData.answer}**.`);
        }

        // Gọi đệ quy dịch chuyển sang vòng kế tiếp
        await channel.send(`⏩ *Hệ thống đang nạp dữ liệu Vòng ${currentRound + 1}...*`);
        runTournamentRound(channel, difficulty, initialLives, reward, currentRound + 1, tournamentStats);
    });
}

// 7. TỔNG KẾT BẢNG XẾP HẠNG GIẢI ĐẤU
async function endTournament(channel, tournamentStats) {
    isTournamentRunning = false; // Giải phóng khóa bot toàn cục

    const leaderboard = Object.entries(tournamentStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); 

    let leaderboardText = '🏆 **TỔNG KẾT GIẢI ĐẤU TOÁN HỌC SEA COINS** 🏆\n\n';
    if (leaderboard.length === 0) {
        leaderboardText += '*Thật đáng tiếc, giải đấu kết thúc mà không một ai tích lũy được Sea Coins nào!*';
    } else {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        leaderboard.forEach(([pId, coins], index) => {
            leaderboardText += `${medals[index]} <@${pId}>: Tích lũy **+${coins} Sea Coins** 🪙 trong giải đấu.\n`;
        });
    }

    leaderboardText += '\n✨ **Trận đấu khép lại hoàn chỉnh!** Hệ thống đã mở lại bỏ phiếu, các bạn có thể gõ `/batdau` để thực hiện một giải đấu mới tinh nhé!';
    await channel.send({ content: leaderboardText });
}

client.login(process.env.DISCORD_TOKEN);
