import PaymentSettings from '../models/PaymentSettings.model.js';

const paymentSettingsController = {
  // Get payment settings (public for frontend, admin for admin panel)
  getPaymentSettings: async (req, res) => {
    try {
      const settings = await PaymentSettings.getSettings();
      
      return res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error('Get payment settings error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching payment settings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Create or update payment settings (admin only)
  updatePaymentSettings: async (req, res) => {
    try {
      const { accountNumber, accountName, bankName, iban } = req.body;
      const qrCode = req.file ? `/uploads/payment-settings/${req.file.filename}` : undefined;

      // Validation
      if (!accountNumber || !accountName || !bankName) {
        return res.status(400).json({
          success: false,
          message: 'Account number, account name, and bank name are required'
        });
      }

      // Get existing settings or create new
      let settings = await PaymentSettings.findOne({ isActive: true });

      if (settings) {
        // Update existing settings
        settings.accountNumber = accountNumber;
        settings.accountName = accountName;
        settings.bankName = bankName;
        if (iban) settings.iban = iban;
        if (qrCode) settings.qrCode = qrCode;
      } else {
        // Create new settings
        settings = new PaymentSettings({
          accountNumber,
          accountName,
          bankName,
          iban: iban || '',
          qrCode: qrCode || '',
          isActive: true
        });
      }

      await settings.save();

      return res.json({
        success: true,
        message: 'Payment settings updated successfully',
        settings
      });
    } catch (error) {
      console.error('Update payment settings error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error updating payment settings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

export default paymentSettingsController;

