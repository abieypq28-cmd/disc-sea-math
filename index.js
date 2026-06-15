const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');

// 1. WEB SERVER CHUẨN ĐỂ ĐÓN PING CRON-JOB TRÊN RENDER
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot Giải Đấu Sea Coins Toán Học đang chạy 24/7!'));
// Lắng nghe trên 0.0.0.0 để Render quét cổng thành công, tránh bị lỗi sập bot sau 10 phút
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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Chỉ Admin mới nhìn thấy lệnh này
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

    // LỆNH MỞ GIẢI ĐẤU GIẢI TRÍ (/batdau) - ĐÃ THAY THẾ BẢN TỐI ƯU MỚI
    if (commandName === 'batdau') {
        if (isTournamentRunning) {
            return interaction.reply({ content: '⚠️ Hệ thống đang chạy một giải đấu rồi! Không thể mở thêm giải đấu song song.', ephemeral: true });
        }

        // Khóa chốt hệ thống ngay lập tức
        isTournamentRunning = true; 

        // Báo nhận lệnh ngay để tránh xoay vòng (Fix triệt để lỗi "Did not respond")
        await interaction.deferReply();

        const votes = { de: new Set(), trungbinh: new Set(), kho: new Set() };

        // Tạo các nút bấm chuẩn hóa, rút gọn tối đa ký tự customId để tránh lỗi dữ liệu của Discord v14
        const btnDe = new ButtonBuilder().setCustomId('v_de').setLabel('🟢 Dễ (0)').setStyle(ButtonStyle.Success);
        const btnTrungBinh = new ButtonBuilder().setCustomId('v_trungbinh').setLabel('🟡 Trung Bình (0)').setStyle(ButtonStyle.Warning);
        const btnKho = new ButtonBuilder().setCustomId('v_kho').setLabel('🔴 Khó (0)').setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(btnDe, btnTrungBinh, btnKho);

        const voteMessage = await interaction.editReply({
            content: `🏆 **KHỞI ĐỘNG GIẢI ĐẤU TOÁN HỌC (20 VÒNG)** 🏆\nCác kỳ phùng thủ có **30 giây** để bấm nút bỏ phiếu chọn độ khó chung!`,
            components: [row]
        });

        const voteCollector = voteMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        voteCollector.on('collect', async (btnInteract) => {
            const vterId = btnInteract.user.id;
            const chosenDiff = btnInteract.customId.split('_')[1]; // Tách lấy 'de', 'trungbinh' hoặc 'kho'
            
            // Xóa phiếu cũ của người này nếu có và nạp vào mục mới chọn
            for (const diff in votes) { votes[diff].delete(vterId); }
            votes[chosenDiff].add(vterId);

            const uRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('v_de').setLabel(`🟢 Dễ (${votes.de.size})`).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('v_trungbinh').setLabel(`🟡 Trung Bình (${votes.trungbinh.size})`).setStyle(ButtonStyle.Warning),
                new ButtonBuilder().setCustomId('v_kho').setLabel(`🔴 Khó (${votes.kho.size})`).setStyle(ButtonStyle.Danger)
            );
            
            await btnInteract.update({ components: [uRow] }).catch(() => {});
        });

        voteCollector.on('end', async () => {
            let finalDiff = 'de'; 
            let maxVotes = votes.de.size;
            
            if (votes.trungbinh.size > maxVotes) { finalDiff = 'trungbinh'; maxVotes = votes.trungbinh.size; }
            if (votes.kho.size > maxVotes) { finalDiff = 'kho'; }

            let reward = 15; let initialLives = 5; let diffLabel = '🟢 DỄ';
            if (finalDiff === 'trungbinh') { reward = 50; initialLives = 3; diffLabel = '🟡 TRUNG BÌNH'; }
            if (finalDiff === 'kho') { reward = 100; initialLives = 2; diffLabel = '🔴 KHÓ VÔ HẠN'; }

            await interaction.followUp({
                content: `🔔 **Hết giờ bầu chọn!** Giải đấu chính thức chốt cấp độ: **${diffLabel}**.\n🚀 **TRẬN ĐẤU BẮT ĐẦU SAU 3 GIÂY!**`
            }).catch(() => {});

            // Chạy đệ quy bắt đầu vòng 1
            runTournamentRound(interaction.channel, finalDiff, initialLives, reward, 1, {});
        });
    }
});

// 6. HÀM CHẠY VÒNG ĐẤU TOÁN HỌC LIÊN TỤC (ĐỆ QUY)
async function runTournamentRound(channel, difficulty, initialLives, reward, currentRound, tournamentStats) {
    if (currentRound > 20) { return endTournament(channel, tournamentStats); }

    await new Promise(resolve => setTimeout(resolve, 3000)); // Nghỉ 3 giây giữa mỗi trận

    const qData = generateSeaMath(difficulty);
    console.log(`[ĐỀ BÀI LOG] Vòng ${currentRound} | Đề: ${qData.text} | Đáp án: ${qData.answer}`);

    await channel.send({
        content: `⚔️ **VÒNG ĐẤU: ${currentRound} / 20** ⚔️\n\n🔢 **ĐỀ BÀI:** Tính giá trị của biểu thức toán học sau:\n👉  **${qData.text} = ?** 👈\n\n⏱️ *Thời gian: **45 giây**. Hãy gõ kết quả số! Gõ sai quá số mạng cá nhân quy định sẽ bị loại.*`
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

        if (isNaN(userAnswer)) return; // Bỏ qua nếu chat bằng chữ viết thông thường

        // Kích hoạt mạng cá nhân cho người chơi mới gõ ở vòng này
        if (playerLives[pId] === undefined) {
            playerLives[pId] = initialLives;
            activePlayersInRound.add(pId);
        }

        // Chặn nếu người chơi này đã cạn mạng từ trước đó trong vòng
        if (playerLives[pId] <= 0) {
            return m.reply(`🚫 Bạn đã hết mạng ở vòng này! Vui lòng đợi vòng tiếp theo nhé.`);
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
            
            // Tự động dừng vòng đấu sớm nếu tất cả những người tham gia đều đã hết sạch mạng
            const anyoneAlive = Array.from(activePlayersInRound).some(id => playerLives[id] > 0);
            if (!anyoneAlive && activePlayersInRound.size > 0) {
                chatCollector.stop('all_dead');
            }
        } else {
            return m.reply(`❌ **Kết quả sai!** <@${pId}> gõ số ${userAnswer}.\n⚠️ Mạng cá nhân còn: **${'❤️'.repeat(playerLives[pId])}**`);
        }
    });

    chatCollector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            await channel.send(`⏱️ **Hết thời gian quy định!** Không anh tài nào giải kịp.\n🤖 Đáp án chuẩn là: **${qData.answer}**.`);
        } 
        else if (reason === 'all_dead') {
            await channel.send(`💀 **TẤT CẢ ĐỀU BỊ LOẠI!** Toàn bộ đấu thủ tham gia vòng này đều đã cạn sạch mạng.\n🤖 Đáp án của bài toán là: **${qData.answer}**.`);
        }

        // Di chuyển đệ quy sang vòng đấu tiếp theo
        await channel.send(`⏩ *Hệ thống đang nạp dữ liệu Vòng ${currentRound + 1}...*`);
        runTournamentRound(channel, difficulty, initialLives, reward, currentRound + 1, tournamentStats);
    });
}

// 7. TỔNG KẾT BẢNG XẾP HẠNG GIẢI ĐẤU GIỮA CÁC ĐẤU THỦ
async function endTournament(channel, tournamentStats) {
    isTournamentRunning = false; // Mở khóa trạng thái toàn cục để cho phép gõ /batdau lần sau

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
