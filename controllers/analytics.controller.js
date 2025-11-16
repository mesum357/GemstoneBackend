import User from '../models/User.model.js';
import Payment from '../models/Payment.model.js';

const analyticsController = {
  // Get analytics data for a specific time period
  getAnalytics: async (req, res) => {
    try {
      const { period } = req.query; // 'week', 'month', or 'all'

      // Calculate date ranges
      const now = new Date();
      let startDate;

      switch (period) {
        case 'week':
          // Start of this week (Monday)
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay() + 1); // Monday
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'month':
          // Start of this month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'all':
        default:
          // All time - no date filter
          startDate = null;
          break;
      }

      // Build date filter
      const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};

      // Count users (only regular users, exclude admins)
      const userFilter = { role: 'user', isActive: true, ...dateFilter };
      const userCount = await User.countDocuments(userFilter);

      // Count orders (payments) - only non-deleted
      const orderFilter = { deletedAt: null, ...dateFilter };
      const orderCount = await Payment.countDocuments(orderFilter);

      // Calculate revenue - sum of verified payments only
      const revenueFilter = { 
        deletedAt: null, 
        status: 'verified',
        ...dateFilter 
      };
      
      const revenueResult = await Payment.aggregate([
        { $match: revenueFilter },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' }
          }
        }
      ]);

      const revenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

      return res.json({
        success: true,
        period: period || 'all',
        analytics: {
          users: userCount,
          orders: orderCount,
          revenue: revenue
        }
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Get all analytics data (week, month, all time) in one call
  getAllAnalytics: async (req, res) => {
    try {
      const now = new Date();

      // Calculate date ranges
      // This week - Start of this week (Monday)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay() + 1);
      weekStart.setHours(0, 0, 0, 0);

      // This month - Start of this month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      monthStart.setHours(0, 0, 0, 0);

      // Helper function to get analytics for a date range
      const getAnalyticsForPeriod = async (startDate) => {
        const dateFilter = startDate ? { createdAt: { $gte: startDate } } : {};

        // Count users
        const userFilter = { role: 'user', isActive: true, ...dateFilter };
        const userCount = await User.countDocuments(userFilter);

        // Count orders
        const orderFilter = { deletedAt: null, ...dateFilter };
        const orderCount = await Payment.countDocuments(orderFilter);

        // Calculate revenue (only verified payments)
        const revenueFilter = { 
          deletedAt: null, 
          status: 'verified',
          ...dateFilter 
        };
        
        const revenueResult = await Payment.aggregate([
          { $match: revenueFilter },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$amount' }
            }
          }
        ]);

        const revenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

        return {
          users: userCount,
          orders: orderCount,
          revenue: revenue
        };
      };

      // Get analytics for all periods
      const [week, month, allTime] = await Promise.all([
        getAnalyticsForPeriod(weekStart),
        getAnalyticsForPeriod(monthStart),
        getAnalyticsForPeriod(null)
      ]);

      return res.json({
        success: true,
        analytics: {
          week,
          month,
          allTime
        }
      });
    } catch (error) {
      console.error('Get all analytics error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

export default analyticsController;

