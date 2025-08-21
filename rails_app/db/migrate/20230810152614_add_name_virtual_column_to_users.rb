class AddNameVirtualColumnToUsers < ActiveRecord::Migration[7.0]
  # Rails doesn't support virtual columns for SQLite yet

  def change
    safety_assured do
      case connection.adapter_name
      when "Trilogy", "Mysql2"
        add_column :users, :name, :virtual, type: :string, as: "CONCAT_WS(' ', first_name, last_name)", stored: true
      when "PostgreSQL"
        add_column :users, :name, :virtual, type: :string, as: "first_name || ' ' || coalesce(last_name, '')", stored: true
      end
    end
  end
end
