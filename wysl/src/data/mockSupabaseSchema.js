// src/data/mockSupabaseSchema.js

const mockSupabaseSchema = {
  tables: [
    {
      name: 'Leads',
      fields: [
        { name: 'id', type: 'number' },
        { name: 'status', type: 'string', options: ['New', 'Contacted', 'Interested', 'Not Interested', 'Converted'] },
        { name: 'source', type: 'string', options: ['Website', 'Referral', 'Cold Call'] },
        { name: 'created_at', type: 'date' },
        { name: 'value', type: 'number' },
        { name: 'is_qualified', type: 'boolean' },
      ],
    },
    {
      name: 'Purchases',
      fields: [
        { name: 'id', type: 'number' },
        { name: 'product_name', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'purchase_date', type: 'date' },
        { name: 'insured', type: 'boolean' },
      ],
    },
    {
      name: 'Users',
      fields: [
        { name: 'id', type: 'number' },
        { name: 'email', type: 'string' },
        { name: 'role', type: 'string', options: ['Admin', 'User', 'Guest'] },
        { name: 'last_login', type: 'date' },
      ],
    },
  ],
  operators: {
    string: ['Equals', 'Not Equals', 'Contains', 'Starts With', 'Ends With'],
    number: ['Equals', 'Not Equals', 'Greater Than', 'Less Than', 'Greater Than or Equal', 'Less Than or Equal'],
    boolean: ['Equals', 'Not Equals'],
    date: ['Equals', 'Not Equals', 'Before', 'After'],
  },
};

export default mockSupabaseSchema;
