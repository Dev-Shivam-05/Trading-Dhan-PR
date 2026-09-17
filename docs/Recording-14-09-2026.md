# Intraday Momentum Trading Scanner: Transcript & Analysis

## 1. Audio Transcript

Speaker ne apni intraday trading strategy ko teen alag-alag hisson mein samjhaya hai. Neeche us recording ka clear aur properly aligned transcript hai:

### Step 1: Scanner Setup (9:20 AM)

> "Stock ke liye na tum aisa karo ki 9 baj ke 20 minute pe morning 9 baj ke 20 minute jab jaise hi 9 20 ho jaye us time pe top gainer aur top loser ka mujhe list chahiye scan karke. Aur usme bhi wo stock chahiye jo FNO mein aate hai matlab ki mujhe saari company nahi chahiye. Jo FNO mein aate hai future and options mein limited stock aate hai 200 around aate honge, to jo FNO mein aate hai wo wale stock ka list pehle matlab system ko bol do ki only FNO stock chahiye. Aur 9 20 ko top gainer aur top loser ka mujhe list chahiye jo FNO wala ho."

### Step 2: Price Action Filter

> "Abhi second step aisa hai ki ye jo stock filter ho ke aaye hamare pass top gainer ya loser wale 9 20 ko aur FNO mein jo aate hai, usme se jiska price intraday mein (LTP change) 2% ya usse jyada hona chahiye 9 20 ko hi. Matlab market khul ke 5 minute hi hua hai aur ye stock 2% bhag chuke hai upar ya niche. Ya to 2% gir chuke hai ya 2% bhag chuke hai."

### Step 3: Open Interest & Final List

> "Third step mein jao tum NSE spurt ki website pe... wahan jake humein check karna hai ki ye jo filter hoke stock aaya upar ki dono condition wala, uska OI change dekhna hai. Change in OI percentage wo 7% se jyada ya 7% ho (= 7 or > 7%). To pehle se pura aisa hai ki 9 20 ko scanner start hoga... man lo 50 stock aaye, usme se FNO wale man lo 15-17 stock bache. Usme second condition (2% plus/minus) lagegi to bach gaye 8-10 stock. Ab NSE spurt pe OI change 7% ya usse jyada hona chahiye. Ye teen condition match hoke jo list aaya na wo list chahiye apne ko 9 20 se 9 30 ke bich mein."

---

## 2. Trading Logic ki Analysis

Yeh recording ek **Intraday Momentum Trading Scanner** banane ka logic define kar rahi hai. Iska main focus market open hote hi pehle 5 se 15 minute ke andar un F&O stocks ko identify karna hai jinme high price volatility ke sath-sath nayi positions (Open Interest) build ho rahi hain.

Is logic ko automate ya manually execute karne ka step-by-step process yeh hoga:

* **Initial F&O Scan (9:20 AM):** Market khulne ke theek 5 minute baad, ek scanner run karna hai jo us din ke Top Gainers aur Top Losers ko identify kare. Isme cash market ki baaki companies ko completely ignore karna hai aur sirf **F&O segment (approx 200 stocks)** par focus karna hai.
* **Momentum Filter (LTP Change >= 2%):** Step 1 se mili list par ek aur filter lagana hai. Sirf wahi stocks select karne hain jinka Last Traded Price (LTP) market open hone se ab tak (9:20 AM tak) **2% ya usse jyada upar (gain) ya 2% ya usse jyada niche (loss)** gaya ho.
* **Open Interest Validation (NSE Spurt):** Jo 8-10 stocks upar ke dono filters pass kar lete hain, unhe 'NSE Spurt' website par cross-verify karna hai. Yahan stock ka **Change in OI (Open Interest) 7% ya usse jyada (>= 7%)** hona chahiye, jo indicate karta hai ki price move mein actual money flow aur fresh contracts involve hain.

In teeno filters ko cross karne ke baad jo final filtered list banegi, woh trader ko **9:20 AM se 9:30 AM** ke window mein trade entry ya observation ke liye use karni hai. Yeh strategy essentially breakout ya breakdown momentum ko volume (OI) ke basis par trade karne ka plan hai.