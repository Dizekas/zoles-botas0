# Discord Watering Bot

## 📜 Aprašymas
Šis bot'as padeda stebėti skirtingų namų palaistymo procentus ir primena, kada reikia palaistyti žolę!

## 📥 Diegimas
1. **Atsisiųsk failus** ir išarchyvuok į norimą aplanką.
2. **Įdiek reikiamus paketus**:
   ```sh
   npm install
   ```
3. **Įrašyk savo bot'o tokeną** į `index.js`:
   ```js
   const TOKEN = 'TAVO_BOT_TOKEN';
   ```
4. **Paleisk bot'ą** su komanda:
   ```sh
   npm start
   ```

## 📌 Komandos
- `%addhouse [namas]` – pridėti naują namą su 100% palaistymu.
- `%set [namas] [procentai]` – nustato konkretaus namo palaistymo procentus.
- `%check` – patikrina visų tavo namų palaistymo lygius.

Bot'as automatiškai atnaujina procentus ir primena, kai reikia palaistyti! 🚀
