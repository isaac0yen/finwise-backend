import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const studentBase = {
  verifyNin: async (nin: string) => {
      if (!process.env.VERIFY_NIN_URL) {
        throw new Error('VERIFY_NIN_URL environment variable is not defined');
      }
      const data = await axios.post(process.env.VERIFY_NIN_URL, {
        number_nin: nin
      }, {
        headers: {
          'accept': 'application/json',
          'app-id': process.env.VERIFY_NIN_APP_ID,
          'content-type': 'application/json',
          'x-api-key': process.env.VERIFY_NIN_API_KEY
        }
      });
      return data.data;
  }
}

export default studentBase;